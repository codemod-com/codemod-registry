/* eslint-disable @typescript-eslint/no-unused-vars */
import { join, posix } from 'node:path';
import tsmorph, {
	ArrowFunction,
	FunctionDeclaration,
	Identifier,
	JsxOpeningElement,
	JsxSelfClosingElement,
	Node,
	SourceFile,
	SyntaxKind,
	FunctionExpression,
} from 'ts-morph';
import type { Repomod } from '@intuita-inc/repomod-engine-api';
import type { fromMarkdown } from 'mdast-util-from-markdown';
import type { visit } from 'unist-util-visit';

type Root = ReturnType<typeof fromMarkdown>;

// eslint-disable-next-line @typescript-eslint/ban-types
type Dependencies = Readonly<{
	tsmorph: typeof tsmorph;
	parseMdx?: (data: string) => Root;
	stringifyMdx?: (tree: Root) => string;
	visitMdxAst?: typeof visit;
}>;

const ROOT_ERROR_CONTENT = `
'use client';
import { useEffect } from 'react';
 
export default function Error({
	error,
	reset,
}: {
	error: Error;
	reset: () => void;
}) {
	useEffect(() => {
		console.error(error);
	}, [ error ]);
 
  	return null;
}
`;

const ROOT_NOT_FOUND_CONTENT = `
export default function NotFound() {
    return null;
}
`;

const enum FilePurpose {
	// root directory
	ROOT_LAYOUT = 'ROOT_LAYOUT',
	ROOT_LAYOUT_COMPONENT = 'ROOT_LAYOUT_COMPONENT',
	ROOT_ERROR = 'ROOT_ERROR',
	ROOT_PAGE = 'ROOT_PAGE',
	ROOT_COMPONENTS = 'ROOT_COMPONENTS',
	ROOT_NOT_FOUND = 'ROOT_NOT_FOUND',
	// route directories
	ROUTE_PAGE = 'ROUTE_PAGE',
	ROUTE_COMPONENTS = 'ROUTE_COMPONENTS',
}

const map = new Map([
	// root directory
	[FilePurpose.ROOT_LAYOUT, ''],
	[FilePurpose.ROOT_LAYOUT_COMPONENT, ''],
	[FilePurpose.ROOT_ERROR, ROOT_ERROR_CONTENT],
	[FilePurpose.ROOT_PAGE, ''],
	[FilePurpose.ROOT_COMPONENTS, ''],
	[FilePurpose.ROOT_NOT_FOUND, ROOT_NOT_FOUND_CONTENT],
	// route directories
	[FilePurpose.ROUTE_PAGE, ''],
	[FilePurpose.ROUTE_COMPONENTS, ''],
]);

const EXTENSION = '.tsx';

type FileAPI = Parameters<NonNullable<Repomod<Dependencies>['handleFile']>>[0];
type DataAPI = Parameters<NonNullable<Repomod<Dependencies>['handleData']>>[0];

type FileCommand = Awaited<
	ReturnType<NonNullable<Repomod<Dependencies>['handleFile']>>
>[number];

type DataCommand = Awaited<
	ReturnType<NonNullable<Repomod<Dependencies>['handleData']>>
>;

const removeUnneededImportDeclarations = (sourceFile: SourceFile) => {
	sourceFile
		.getImportDeclarations()
		.filter((declaration) => {
			if (
				declaration.getModuleSpecifier().getLiteralText() ===
					'next/head' &&
				declaration.getImportClause()?.getText() === 'Head'
			) {
				return true;
			}

			const defaultImport = declaration.getDefaultImport() ?? null;

			if (defaultImport !== null) {
				const text = defaultImport.getText();

				return (
					sourceFile
						.getDescendantsOfKind(tsmorph.ts.SyntaxKind.Identifier)
						.filter((identifier) => identifier.getText() === text)
						.length === 1
				);
			}

			return declaration.getNamedImports().every((namedImport) => {
				const text = namedImport.getText();

				return (
					sourceFile
						.getDescendantsOfKind(tsmorph.ts.SyntaxKind.Identifier)
						.filter((identifier) => identifier.getText() === text)
						.length === 1
				);
			});
		})
		.forEach((declaration) => {
			declaration.remove();
		});
};

const buildComponentsFileData = (
	api: DataAPI,
	path: string,
	options: Readonly<Record<string, string | undefined>>,
	filePurpose: FilePurpose.ROOT_COMPONENTS | FilePurpose.ROUTE_COMPONENTS,
): DataCommand => {
	const { tsmorph, parseMdx, stringifyMdx, visitMdxAst } =
		api.getDependencies();

	let sourcingStatementInserted = false;

	const rewriteWithTsMorph = (input: string) => {
		const project = new tsmorph.Project({
			useInMemoryFileSystem: true,
			skipFileDependencyResolution: true,
			compilerOptions: {
				allowJs: true,
			},
		});

		const sourceFile = project.createSourceFile(
			options.oldPath ?? '',
			input,
		);

		sourceFile.getFunctions().forEach((fn) => {
			const id = fn.getName() ?? '';

			if (
				[
					'getStaticProps',
					'getServerSideProps',
					'getStaticPaths',
					'generateMetadata',
				].includes(id)
			) {
				fn.remove();
			}
		});

		sourceFile.getVariableStatements().forEach((statement) => {
			statement.getDeclarations().forEach((declaration) => {
				const id = declaration.getName() ?? '';

				if (
					[
						'getStaticProps',
						'getServerSideProps',
						'getStaticPaths',
						'generateMetadata',
						'metadata',
					].includes(id)
				) {
					declaration.remove();
				}
			});
		});

		removeUnneededImportDeclarations(sourceFile);

		sourceFile
			.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
			.filter(
				(jsxOpeningElement) =>
					jsxOpeningElement.getTagNameNode().getText() === 'Head',
			)
			.map((declaration) => {
				return declaration.getFirstAncestorByKind(
					SyntaxKind.JsxElement,
				);
			})
			.forEach((jsxElement) => {
				const parenthesizedExpressionParent =
					jsxElement?.getParentIfKind(
						SyntaxKind.ParenthesizedExpression,
					) ?? null;

				if (parenthesizedExpressionParent !== null) {
					parenthesizedExpressionParent.replaceWithText('null');

					return;
				}

				jsxElement?.replaceWithText('');
			});

		if (filePurpose === FilePurpose.ROUTE_COMPONENTS) {
			sourceFile.getImportDeclarations().forEach((declaration) => {
				const moduleSpecifier = declaration.getModuleSpecifierValue();

				if (moduleSpecifier.startsWith('./')) {
					declaration.setModuleSpecifier(`.${moduleSpecifier}`);
				} else if (moduleSpecifier.startsWith('../')) {
					declaration.setModuleSpecifier(`../${moduleSpecifier}`);
				}
			});
		}

		if (!sourcingStatementInserted) {
			sourceFile.insertStatements(0, [
				`'use client';`,
				`// This file has been sourced from: ${options.oldPath}`,
			]);

			sourcingStatementInserted = true;
		}

		return sourceFile.print();
	};

	if (path.endsWith('.mdx')) {
		if (parseMdx && stringifyMdx && visitMdxAst) {
			const tree = parseMdx(options.oldData ?? '');

			visitMdxAst(tree, (node) => {
				if (node.type === 'mdxjsEsm') {
					node.value = rewriteWithTsMorph(node.value);

					delete node.data;
					delete node.position;

					return 'skip';
				}
			});

			const data = stringifyMdx(tree);

			return {
				kind: 'upsertData',
				path,
				data,
			};
		} else {
			return {
				kind: 'noop',
			};
		}
	}

	return {
		kind: 'upsertData',
		path,
		data: rewriteWithTsMorph(options.oldData ?? ''),
	};
};

const buildPageFileData = (
	api: DataAPI,
	path: string,
	options: Readonly<Record<string, string | undefined>>,
	filePurpose: FilePurpose.ROOT_PAGE | FilePurpose.ROUTE_PAGE,
): DataCommand => {
	const { tsmorph, parseMdx, stringifyMdx, visitMdxAst } =
		api.getDependencies();

	let sourcingStatementInserted = false;

	const rewriteWithTsMorph = (input: string): string => {
		const project = new tsmorph.Project({
			useInMemoryFileSystem: true,
			skipFileDependencyResolution: true,
			compilerOptions: {
				allowJs: true,
			},
		});

		const sourceFile = project.createSourceFile(
			options.oldPath ?? '',
			input,
		);

		sourceFile.getFunctions().forEach((fn) => {
			if (fn.isDefaultExport()) {
				fn.remove();
				return;
			}

			const id = fn.getName() ?? '';

			if (
				[
					'getStaticProps',
					'getServerSideProps',
					'getStaticPaths',
				].includes(id)
			) {
				fn.setIsExported(false);
			}
		});

		sourceFile.getVariableStatements().forEach((statement) => {
			statement.getDeclarations().forEach((declaration) => {
				const id = declaration.getName() ?? '';

				if (
					[
						'getStaticProps',
						'getServerSideProps',
						'getStaticPaths',
					].includes(id) &&
					declaration.hasExportKeyword()
				) {
					statement.setIsExported(false);
				}
			});
		});

		removeUnneededImportDeclarations(sourceFile);

		sourceFile
			.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
			.filter(
				(jsxOpeningElement) =>
					jsxOpeningElement.getTagNameNode().getText() === 'Head',
			)
			.map((declaration) => {
				return declaration.getFirstAncestorByKind(
					SyntaxKind.JsxElement,
				);
			})
			.forEach((jsxElement) => {
				const parenthesizedExpressionParent =
					jsxElement?.getParentIfKind(
						SyntaxKind.ParenthesizedExpression,
					) ?? null;

				if (parenthesizedExpressionParent !== null) {
					parenthesizedExpressionParent.replaceWithText('null');

					return;
				}

				jsxElement?.replaceWithText('');
			});

		if (filePurpose === FilePurpose.ROUTE_PAGE) {
			sourceFile.getImportDeclarations().forEach((declaration) => {
				const moduleSpecifier = declaration.getModuleSpecifierValue();

				if (moduleSpecifier.startsWith('./')) {
					declaration.setModuleSpecifier(`.${moduleSpecifier}`);
				} else if (moduleSpecifier.startsWith('../')) {
					declaration.setModuleSpecifier(`../${moduleSpecifier}`);
				}
			});
		}

		sourceFile.addImportDeclaration({
			moduleSpecifier: './components',
			defaultImport: 'Components',
		});

		sourceFile.getStatementsWithComments().forEach((statement, index) => {
			if (tsmorph.Node.isVariableStatement(statement)) {
				const declarations = statement
					.getDeclarationList()
					.getDeclarations();

				const getServerSidePropsUsed = declarations.some(
					(declaration) =>
						declaration.getName() === 'getServerSideProps',
				);

				if (getServerSidePropsUsed) {
					sourceFile.insertStatements(
						index,
						'// TODO reimplement getServerSideProps with custom logic\n',
					);
				}
			}
		});

		if (!sourcingStatementInserted) {
			sourceFile.insertStatements(
				0,
				`// This file has been sourced from: ${options.oldPath}`,
			);

			sourcingStatementInserted = true;
		}

		sourceFile.addStatements(`export default async function Page(props: any) {
			return <Components {...props} />;
		}`);

		return sourceFile.print();
	};

	if (path.endsWith('.mdx')) {
		if (parseMdx && stringifyMdx && visitMdxAst) {
			const tree = parseMdx(options.oldData ?? '');

			visitMdxAst(tree, (node) => {
				if (node.type === 'mdxjsEsm') {
					node.value = rewriteWithTsMorph(node.value);

					delete node.data;
					delete node.position;

					return 'skip';
				}
			});

			const data = stringifyMdx(tree);

			return {
				kind: 'upsertData',
				path,
				data,
			};
		} else {
			return {
				kind: 'noop',
			};
		}
	}

	return {
		kind: 'upsertData',
		path,
		data: rewriteWithTsMorph(options.oldData ?? ''),
	};
};

const resolveExtensionlessFilePath = (
	extensionlessFilePath: string,
	fileApi: FileAPI,
): string | null => {
	let resolvedPath: string | null = null;

	['jsx', 'tsx', 'js', 'ts'].forEach((ext) => {
		const path = `${extensionlessFilePath}.${ext}`;

		if (fileApi.exists(path)) {
			resolvedPath = path;
		}
	});

	return resolvedPath;
};

const findJsxTagsByImportName = (
	sourceFile: SourceFile,
	moduleSpecifier: string,
) => {
	const importDeclarations = sourceFile.getImportDeclarations();

	const importDeclaration = importDeclarations.find((importDeclaration) => {
		const moduleSpecifierText = importDeclaration
			.getModuleSpecifier()
			.getText();

		return (
			moduleSpecifierText.substring(1, moduleSpecifierText.length - 1) ===
			moduleSpecifier
		);
	});

	if (importDeclaration === undefined) {
		return [];
	}

	const importedIdentifiers: Identifier[] = [];

	const defaultImport = importDeclaration?.getDefaultImport();

	if (defaultImport) {
		importedIdentifiers.push(defaultImport);
	}

	(importDeclaration?.getNamedImports() ?? []).forEach((namedImport) => {
		importedIdentifiers.push(namedImport.getNameNode());
	});

	const jsxTags: (JsxSelfClosingElement | JsxOpeningElement)[] = [];

	importedIdentifiers.forEach((identifier) => {
		const refs = identifier.findReferencesAsNodes();

		refs.forEach((ref) => {
			const parent = ref.getParent();

			if (
				Node.isJsxSelfClosingElement(parent) ||
				Node.isJsxOpeningElement(parent)
			) {
				jsxTags.push(parent);
			}
		});
	});

	return jsxTags;
};

const replaceNextDocumentJsxTags = (sourceFile: SourceFile) => {
	const nextDocumentJsxTags = findJsxTagsByImportName(
		sourceFile,
		'next/document',
	);

	nextDocumentJsxTags.forEach((jsxTag) => {
		const tagNameNode = jsxTag.getTagNameNode();
		const tagName = tagNameNode.getText();

		if (tagName === 'Main') {
			return;
		}

		if (tagName === 'NextScript') {
			jsxTag.replaceWithText('');
			return;
		}

		if (
			Node.isIdentifier(tagNameNode) &&
			['Html', 'Head'].includes(tagName)
		) {
			tagNameNode.rename(tagName.toLowerCase());
		}
	});
};

const removeNextDocumentImport = (sourceFile: SourceFile) => {
	const importDeclarations = sourceFile.getImportDeclarations();

	const importDeclaration = importDeclarations.find((importDeclaration) => {
		const moduleSpecifierText = importDeclaration
			.getModuleSpecifier()
			.getText();

		return (
			moduleSpecifierText.substring(1, moduleSpecifierText.length - 1) ===
			'next/document'
		);
	});

	importDeclaration?.remove();
};

const updateLayoutComponent = (sourceFile: SourceFile) => {
	const layoutComponent = sourceFile
		.getFunctions()
		.find((f) => f.isDefaultExport());

	if (layoutComponent === undefined) {
		return;
	}

	layoutComponent.rename('RootLayout');

	const param = layoutComponent.getParameters()[0];

	if (param === undefined) {
		layoutComponent.addParameter({
			name: `{children}`,
			type: `{
				children: React.ReactNode
			}`,
		});
		return;
	}

	param.replaceWithText(`{
		children,
	}: {
		children: React.ReactNode
	}`);
};

const findComponent = (sourceFile: SourceFile) => {
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

const buildLayoutClientComponentFromUnderscoreApp = (
	sourceFile: SourceFile,
) => {
	const component = findComponent(sourceFile);

	if (component === null) {
		return;
	}

	if (!Node.isArrowFunction(component)) {
		component.rename('LayoutClientComponent');
	}

	const param = component.getParameters()[0];
	param?.remove();

	component.addParameter({
		name: `{children}`,
		type: `{
				children: React.ReactNode
			}`,
	});

	const returnStatement = component.getFirstDescendantByKind(
		SyntaxKind.ReturnStatement,
	);

	returnStatement
		?.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
		.find(
			(jsxElement) =>
				jsxElement.getTagNameNode().getText() === 'Component',
		)
		?.replaceWithText('<>{ children }</>');

	sourceFile.insertStatements(0, '"use client" \n');
};

const injectLayoutClientComponent = (sourceFile: SourceFile) => {
	const mainJsxTag = sourceFile
		.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
		.find((jsxElement) => jsxElement.getTagNameNode().getText() === 'Main');

	mainJsxTag?.replaceWithText('<LayoutClientComponent />');

	sourceFile.insertStatements(
		0,
		'import LayoutClientComponent from "./layout-client-component"',
	);
};

const handleFile: Repomod<Dependencies>['handleFile'] = async (
	api,
	path,
	options,
) => {
	const parsedPath = posix.parse(path);
	const directoryNames = parsedPath.dir.split(posix.sep);
	const endsWithPages =
		directoryNames.length > 0 &&
		directoryNames.lastIndexOf('pages') === directoryNames.length - 1;

	const nameIsIndex = parsedPath.name === 'index';

	if (endsWithPages && nameIsIndex) {
		const newDir = directoryNames
			.slice(0, -1)
			.concat('app')
			.join(posix.sep);

		const rootErrorPath = posix.format({
			root: parsedPath.root,
			dir: newDir,
			ext: EXTENSION,
			name: 'error',
		});

		const rootNotFoundPath = posix.format({
			root: parsedPath.root,
			dir: newDir,
			ext: EXTENSION,
			name: 'not-found',
		});

		const rootPagePath = posix.format({
			root: parsedPath.root,
			dir: newDir,
			ext: EXTENSION,
			name: 'page',
		});

		const jsxErrorPath = posix.format({
			...parsedPath,
			name: '_error',
			ext: '.jsx',
			base: undefined,
		});

		const tsxErrorPath = posix.format({
			...parsedPath,
			name: '_error',
			ext: '.tsx',
			base: undefined,
		});

		const rootErrorPathIncluded =
			api.exists(jsxErrorPath) || api.exists(tsxErrorPath);

		const jsxNotFoundPath = posix.format({
			...parsedPath,
			name: '_404',
			ext: '.jsx',
			base: undefined,
		});

		const tsxNotFoundPath = posix.format({
			...parsedPath,
			name: '_404',
			ext: '.tsx',
			base: undefined,
		});

		const rootNotFoundPathIncluded =
			api.exists(jsxNotFoundPath) || api.exists(tsxNotFoundPath);

		const oldData = await api.readFile(path);

		const commands: FileCommand[] = [
			{
				kind: 'upsertFile' as const,
				path: posix.format({
					root: parsedPath.root,
					dir: newDir,
					ext: EXTENSION,
					name: 'page',
				}),
				options: {
					...options,
					filePurpose: FilePurpose.ROOT_PAGE,
					oldPath: path,
					oldData,
				},
			},
			{
				kind: 'upsertFile' as const,
				path: posix.format({
					root: parsedPath.root,
					dir: newDir,
					ext: EXTENSION,
					name: 'components',
				}),
				options: {
					...options,
					filePurpose: FilePurpose.ROOT_COMPONENTS,
					oldPath: path,
					oldData,
				},
			},
			{
				kind: 'deleteFile' as const,
				path,
			},
		];

		const extensiolessUnderscoreDocumentPath = join(
			parsedPath.dir,
			'_document',
		);
		const underscoreDocumentPath = resolveExtensionlessFilePath(
			extensiolessUnderscoreDocumentPath,
			api,
		);

		const extensionlessUnderscoreAppPath = join(parsedPath.dir, '_app');

		const underscoreAppPath = resolveExtensionlessFilePath(
			extensionlessUnderscoreAppPath,
			api,
		);

		if (underscoreDocumentPath !== null && underscoreAppPath !== null) {
			const underscoreDocumentData = await api.readFile(
				underscoreDocumentPath,
			);

			const underscoreAppData = await api.readFile(underscoreAppPath);

			commands.unshift({
				kind: 'upsertFile' as const,
				path: posix.format({
					root: parsedPath.root,
					dir: newDir,
					ext: EXTENSION,
					name: 'layout-client-component',
				}),
				options: {
					...options,
					underscoreAppPath,
					underscoreAppData,
					filePurpose: FilePurpose.ROOT_LAYOUT_COMPONENT,
				},
			});

			commands.unshift({
				kind: 'upsertFile' as const,
				path: posix.format({
					root: parsedPath.root,
					dir: newDir,
					ext: EXTENSION,
					name: 'layout',
				}),
				options: {
					...options,
					underscoreDocumentPath,
					underscoreDocumentData,
					filePurpose: FilePurpose.ROOT_LAYOUT,
				},
			});
		}

		if (rootErrorPathIncluded) {
			commands.push({
				kind: 'upsertFile' as const,
				path: rootErrorPath,
				options: {
					...options,
					filePurpose: FilePurpose.ROOT_ERROR,
				},
			});
		}

		if (rootNotFoundPathIncluded) {
			commands.push({
				kind: 'upsertFile' as const,
				path: rootNotFoundPath,
				options: {
					...options,
					filePurpose: FilePurpose.ROOT_NOT_FOUND,
				},
			});
		}

		return commands;
	}

	if (!endsWithPages) {
		const newDirArr = directoryNames.map((name) =>
			name.replace('pages', 'app'),
		);

		if (!nameIsIndex) {
			newDirArr.push(parsedPath.name);
		}

		const newDir = newDirArr.join(posix.sep);

		const oldData = await api.readFile(path);

		const commands: FileCommand[] = [
			{
				kind: 'upsertFile',
				path: posix.format({
					root: parsedPath.root,
					dir: newDir,
					ext: parsedPath.ext === '.mdx' ? '.mdx' : '.tsx',
					name: 'page',
				}),
				options: {
					...options,
					filePurpose: FilePurpose.ROUTE_PAGE,
					oldPath: path,
					oldData,
				},
			},
			{
				kind: 'upsertFile',
				path: posix.format({
					root: parsedPath.root,
					dir: newDir,
					ext: parsedPath.ext === '.mdx' ? '.mdx' : '.tsx',
					name: 'components',
				}),
				options: {
					...options,
					filePurpose: FilePurpose.ROUTE_COMPONENTS,
					oldPath: path,
					oldData,
				},
			},
			{
				kind: 'deleteFile' as const,
				path,
			},
		];

		return commands;
	}

	if (parsedPath.name === '_app' || parsedPath.name === '_document') {
		return [
			{
				kind: 'deleteFile',
				path,
			},
		];
	}

	return [];
};

const handleData: Repomod<Dependencies>['handleData'] = async (
	api,
	path,
	__,
	options,
) => {
	const filePurpose = (options.filePurpose ?? null) as FilePurpose | null;

	if (filePurpose === null) {
		return {
			kind: 'noop',
		};
	}

	const content = map.get(filePurpose) ?? null;

	if (content === null) {
		return {
			kind: 'noop',
		};
	}

	if (
		(filePurpose === FilePurpose.ROOT_COMPONENTS ||
			filePurpose === FilePurpose.ROUTE_COMPONENTS) &&
		options.oldPath
	) {
		return buildComponentsFileData(api, path, options, filePurpose);
	}

	if (
		(filePurpose === FilePurpose.ROUTE_PAGE ||
			filePurpose === FilePurpose.ROOT_PAGE) &&
		options.oldPath
	) {
		return buildPageFileData(api, path, options, filePurpose);
	}

	if (
		filePurpose === FilePurpose.ROOT_LAYOUT &&
		options.underscoreDocumentData
	) {
		const { tsmorph } = api.getDependencies();

		const project = new tsmorph.Project({
			useInMemoryFileSystem: true,
			skipFileDependencyResolution: true,
			compilerOptions: {
				allowJs: true,
			},
		});

		const sourceFile = project.createSourceFile(
			path,
			options.underscoreDocumentData,
		);

		replaceNextDocumentJsxTags(sourceFile);
		removeNextDocumentImport(sourceFile);
		updateLayoutComponent(sourceFile);
		injectLayoutClientComponent(sourceFile);

		return {
			kind: 'upsertData',
			path,
			data: sourceFile.print(),
		};
	}

	if (
		filePurpose === FilePurpose.ROOT_LAYOUT_COMPONENT &&
		options.underscoreAppData &&
		options.underscoreAppPath
	) {
		const { tsmorph } = api.getDependencies();

		const project = new tsmorph.Project({
			useInMemoryFileSystem: true,
			skipFileDependencyResolution: true,
			compilerOptions: {
				allowJs: true,
			},
		});

		const underscoreAppFile = project.createSourceFile(
			options.underscoreAppPath,
			options.underscoreAppData,
		);

		buildLayoutClientComponentFromUnderscoreApp(underscoreAppFile);

		return {
			kind: 'upsertData',
			path,
			data: underscoreAppFile.print(),
		};
	}

	return {
		kind: 'upsertData',
		path,
		data: content,
	};
};

export const repomod: Repomod<Dependencies> = {
	includePatterns: ['**/pages/**/*.{js,jsx,ts,tsx,cjs,mjs,mdx}'],
	excludePatterns: ['**/node_modules/**', '**/pages/api/**'],
	handleFile,
	handleData,
};
