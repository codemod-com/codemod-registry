import tsmorph, { ArrowFunction, FunctionDeclaration, FunctionExpression, Node, SyntaxKind, SourceFile } from 'ts-morph';

import type {
	Repomod,
	UnifiedFileSystem,
} from '@intuita-inc/repomod-engine-api';
import type { fromMarkdown } from 'mdast-util-from-markdown';
import type { visit } from 'unist-util-visit';
import { posix } from 'node:path';
import { ParsedPath } from 'path/posix';

type Root = ReturnType<typeof fromMarkdown>;

// eslint-disable-next-line @typescript-eslint/ban-types
type Dependencies = Readonly<{
	tsmorph: typeof tsmorph;
	parseMdx?: (data: string) => Root;
	stringifyMdx?: (tree: Root) => string;
	visitMdxAst?: typeof visit;
	unifiedFileSystem: UnifiedFileSystem;
}>;


const getNewDirectoryName = ({ dir, name }: ParsedPath) => {
	const directoryNameSegments = dir.split(posix.sep);

	const newDirectoryNameSegments = directoryNameSegments.map(segment => segment === 'pages' ? 'app' : segment);

	if (name !== 'index') {
		newDirectoryNameSegments.push(name);
	}

	return newDirectoryNameSegments.join(posix.sep);
}

type TheFunction = ArrowFunction | FunctionExpression | FunctionDeclaration;

const findAPIRouteHandler = (sourceFile: SourceFile): TheFunction | null => {
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

const HTTP_METHODS = [
	'GET',
	'POST',
	'PUT',
	'DELETE',
	'PATCH',
] as const;

export type HTTPMethod = typeof HTTP_METHODS[number];

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

				const rightNodeTextWithoutQuotes = rightNodeText.substring(1, rightNodeText.length - 1) as HTTPMethod;

				if (HTTP_METHODS.includes(rightNodeTextWithoutQuotes)) {
					HTTPMethodHandlers.set(rightNodeTextWithoutQuotes, node.getThenStatement().getText())
				}
			}
		}
	});


	const positionAfterImports = getPositionAfterImports(sourceFile);

	// @TODO
	const usesRequest = false;
	const usesResponse = true;

	if (usesRequest || usesResponse) {
		sourceFile.insertStatements(0, `import { ${usesRequest ? 'NextRequest ,' : ''} ${usesResponse ? 'NextResponse' : ''} } from 'next/server'`)
	}


	Array.from(HTTPMethodHandlers).forEach(([method, handler]) => {
		sourceFile.insertStatements(positionAfterImports, `export async function ${method}() 
			 ${handler}
			`);
	})
}

export const repomod: Repomod<Dependencies> = {
	includePatterns: ['**/pages/api/**/*.{js,ts,cjs,ejs}'],
	excludePatterns: ['**/node_modules/**'],
	handleFile: async (api, path) => {
		const parsedPath = posix.parse(path);

		const oldData = await api.readFile(path);

		return [{
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
			}
		}];
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
