import tsmorph, {
	ArrowFunction,
	FunctionDeclaration,
	FunctionExpression,
	Node,
	SyntaxKind,
	SourceFile,
	CallExpression,
} from 'ts-morph';

import type {
	Repomod,
	UnifiedFileSystem,
} from '@intuita-inc/repomod-engine-api';

import { posix } from 'node:path';
import { ParsedPath } from 'path/posix';

// eslint-disable-next-line @typescript-eslint/ban-types
type Dependencies = Readonly<{
	tsmorph: typeof tsmorph;
	unifiedFileSystem: UnifiedFileSystem;
}>;

type Handler = ArrowFunction | FunctionExpression | FunctionDeclaration;

const getNewDirectoryName = ({ dir, name }: ParsedPath) => {
	const directoryNameSegments = dir.split(posix.sep);

	const newDirectoryNameSegments = directoryNameSegments.map((segment) =>
		segment === 'pages' ? 'app' : segment,
	);

	if (name !== 'index') {
		newDirectoryNameSegments.push(name);
	}

	return newDirectoryNameSegments.join(posix.sep);
};

const findAPIRouteHandler = (sourceFile: SourceFile): Handler | null => {
	const defaultExportedFunctionDeclaration = sourceFile
		.getFunctions()
		.find((f) => f.isDefaultExport());

	if (defaultExportedFunctionDeclaration !== undefined) {
		return defaultExportedFunctionDeclaration;
	}

	const exportAssignment = sourceFile
		.getStatements()
		.find((s) => Node.isExportAssignment(s));

	const declarations =
		exportAssignment
			?.getFirstDescendantByKind(SyntaxKind.Identifier)
			?.getSymbol()
			?.getDeclarations() ?? [];

	let component:
		| ArrowFunction
		| FunctionExpression
		| FunctionDeclaration
		| undefined;

	declarations.forEach((d) => {
		if (Node.isVariableDeclaration(d)) {
			const initializer = d?.getInitializer();

			if (
				Node.isArrowFunction(initializer) ||
				Node.isFunctionExpression(initializer)
			) {
				component = initializer;
				return;
			}
		}

		if (Node.isFunctionDeclaration(d)) {
			component = d;
		}
	});

	return component ?? null;
};

const getPositionAfterImports = (sourceFile: SourceFile): number => {
	const lastImportDeclaration =
		sourceFile.getLastChildByKind(SyntaxKind.ImportDeclaration) ?? null;

	return (lastImportDeclaration?.getChildIndex() ?? 0) + 1;
};

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

export type HTTPMethod = (typeof HTTP_METHODS)[number];

const RESPONSE_INIT_FIELDS = ['headers', 'status', 'statusText'] as const;

type ResponseInitParam = (typeof RESPONSE_INIT_FIELDS)[number];
type ResponseInit = Partial<{ [k in ResponseInitParam]: unknown }>;

const unquotify = (input: string): string => {
	if (
		(input.startsWith('"') && input.endsWith('"')) ||
		(input.startsWith(`'`) && input.endsWith(`'`))
	) {
		return input.slice(1, -1);
	}

	return input;
};

// res.status() => status
const getCallExpressionName = (callExpression: CallExpression) => {
	const expression = callExpression.getExpression();

	if (!Node.isPropertyAccessExpression(expression)) {
		return null;
	}

	return expression.getName();
};

const rewriteResponseCallExpressions = (handler: Handler) => {
	const responseInit: ResponseInit = {};

	const callExpressions = handler
		.getDescendantsOfKind(SyntaxKind.CallExpression)
		.filter((callExpression) => {
			return getCallExpressionName(callExpression) === 'json';
		});

	callExpressions.forEach((callExpression) => {
		const childCallExpressions = callExpression.getDescendantsOfKind(
			SyntaxKind.CallExpression,
		);

		childCallExpressions.forEach((childCallExpression) => {
			const name = getCallExpressionName(childCallExpression);

			if (RESPONSE_INIT_FIELDS.includes(name as ResponseInitParam)) {
				responseInit[name as ResponseInitParam] = unquotify(
					childCallExpression.getArguments()[0]?.getText() ?? '',
				);
			}
		});

		const callExpressionArg =
			callExpression.getArguments()[0]?.getText() ?? '';

		const idx = callExpression.getChildIndex();
		handler.removeStatement(idx);
		handler.insertStatements(
			idx,
			`return NextResponse.json(${callExpressionArg}, ${JSON.stringify(
				responseInit,
			)})`,
		);
	});
};

// const rewriteReqResImports = (sourceFile: SourceFile) => {
// 	const importDeclaration = sourceFile.getImportDeclarations().find(d => unquotify(d.getModuleSpecifier().getText()) === 'next');

// 	if (importDeclaration === undefined) {
// 		return;
// 	}

// 	importDeclaration.setIsTypeOnly(false);

// 	importDeclaration?.getDescendantsOfKind(SyntaxKind.Identifier).forEach(i => {
// 		if (i.getText() === 'NextApiRequest') {
// 			i.rename('NextRequest');

// 			const importSpecifier = i.getFirstAncestorByKind(SyntaxKind.ImportSpecifier);
// 			importSpecifier?.setIsTypeOnly(true);
// 		}

// 		if (i.getText() === 'NextApiResponse') {
// 			i.rename('NextResponse')
// 		}
// 	})

// 	importDeclaration?.getModuleSpecifier().replaceWithText(`'next/server'`);
// }

const rewriteReqResImports = (sourceFile: SourceFile) => {
	const importDeclaration = sourceFile
		.getImportDeclarations()
		.find((d) => unquotify(d.getModuleSpecifier().getText()) === 'next');
	importDeclaration?.remove();

	sourceFile.insertStatements(
		0,
		`import { type NextRequest, NextResponse } from 'next/server';`,
	);
};

const rewriteParams = (handler: Handler) => {
	const params = handler.getParameters();

	params[0]?.setType('NextRequest');
	params[1]?.remove();
};

const rewriteAPIRoute = (sourceFile: SourceFile) => {
	const HTTPMethodHandlers = new Map<HTTPMethod, string>();

	const handler = findAPIRouteHandler(sourceFile);

	if (handler === null) {
		return;
	}

	const handlerBody = handler.getBody() ?? null;

	if (handlerBody === null) {
		return;
	}

	handlerBody.getDescendants().forEach((node) => {
		if (Node.isIfStatement(node)) {
			const condition = node.getExpression();
			if (
				Node.isBinaryExpression(condition) &&
				condition.getLeft().getText() === 'req.method'
			) {
				const rightNodeText = condition.getRight().getText();

				const rightNodeTextWithoutQuotes = rightNodeText.substring(
					1,
					rightNodeText.length - 1,
				) as HTTPMethod;

				if (HTTP_METHODS.includes(rightNodeTextWithoutQuotes)) {
					HTTPMethodHandlers.set(
						rightNodeTextWithoutQuotes,
						node.getThenStatement().getText(),
					);
				}
			}
		}
	});

	const positionAfterImports = getPositionAfterImports(sourceFile);

	Array.from(HTTPMethodHandlers).forEach(([method, methodHandler]) => {
		const [statement] = sourceFile.insertStatements(
			positionAfterImports,
			`export async function ${method}(${
				handler.getParameters()[0]?.getText() ?? ''
			}) 
			 ${methodHandler}
			`,
		);

		rewriteResponseCallExpressions(statement as Handler);
		rewriteParams(statement as Handler);
	});

	const pos = Node.isFunctionDeclaration(handler)
		? handler.getChildIndex()
		: handler
				.getFirstAncestorByKind(SyntaxKind.VariableStatement)
				?.getChildIndex();

	if (pos !== undefined) {
		sourceFile.removeStatement(pos);
	}

	const defaultExport = sourceFile.getDescendantsOfKind(
		SyntaxKind.ExportAssignment,
	)[0];

	if (defaultExport) {
		sourceFile.removeStatement(defaultExport.getChildIndex());
	}

	rewriteReqResImports(sourceFile);
};

export const repomod: Repomod<Dependencies> = {
	includePatterns: ['**/pages/api/**/*.{js,ts,cjs,ejs}'],
	excludePatterns: ['**/node_modules/**'],
	handleFile: async (api, path) => {
		const parsedPath = posix.parse(path);

		const oldData = await api.readFile(path);

		return [
			{
				kind: 'upsertFile',
				path: posix.format({
					root: parsedPath.root,
					dir: getNewDirectoryName(parsedPath),
					ext: '.ts',
					name: 'route',
				}),
				options: {
					oldPath: path,
					oldData,
				},
			},
		];
	},
	handleData: async (api, path, data, options) => {
		const project = new tsmorph.Project({
			useInMemoryFileSystem: true,
			skipFileDependencyResolution: true,
			compilerOptions: {
				allowJs: true,
			},
		});

		const sourceFile = project.createSourceFile(
			options.oldPath ?? '',
			options.oldData,
		);

		rewriteAPIRoute(sourceFile);

		return {
			kind: 'upsertData',
			path,
			data: sourceFile.print(),
		};
	},
};
