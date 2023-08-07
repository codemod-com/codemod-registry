import { ParsedPath, posix } from 'node:path';
import tsmorph, {
	Identifier,
	JsxOpeningElement,
	JsxSelfClosingElement,
	Node,
	SourceFile,
	SyntaxKind,
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

const ROOT_LAYOUT_CONTENT = `
// remove the following lines if you do not use metadata in the root layout
// import { Metadata } from 'next';
 
// export const metadata: Metadata = {
// 	title: '',
// 	description: '',
// };

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body>{children}</body>
	  	</html>
	);
}
`;

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

enum FilePurpose {
	// root directory
	ROOT_LAYOUT = 'ROOT_LAYOUT',
	ROOT_ERROR = 'ROOT_ERROR',
	ROOT_PAGE = 'ROOT_PAGE',
	ROOT_COMPONENTS = 'ROOT_COMPONENTS',
	ROOT_NOT_FOUND = 'ROOT_NOT_FOUND',
	// route directories
	ROUTE_PAGE = 'ROUTE_PAGE',
	ROUTE_COMPONENTS = 'ROUTE_COMPONENTS',
}

const map = new Map([
	[FilePurpose.ROOT_LAYOUT, ROOT_LAYOUT_CONTENT],
	[FilePurpose.ROOT_ERROR, ROOT_ERROR_CONTENT],
	[FilePurpose.ROOT_NOT_FOUND, ROOT_NOT_FOUND_CONTENT],
	[FilePurpose.ROOT_PAGE, ''],
	[FilePurpose.ROOT_COMPONENTS, ''],
	[FilePurpose.ROUTE_PAGE, ''],
	[FilePurpose.ROUTE_COMPONENTS, ''],
]);

const EXTENSION = '.tsx';

type FileAPI = Parameters<NonNullable<Repomod<Dependencies>['handleFile']>>[0];
type DataAPI = Parameters<NonNullable<Repomod<Dependencies>['handleData']>>[0];

type Unpromisify<T> = T extends Promise<infer U> ? U : never;

type FileCommand = Unpromisify<
	ReturnType<NonNullable<Repomod<Dependencies>['handleFile']>>
>[number];

type DataCommand = Unpromisify<
	ReturnType<NonNullable<Repomod<Dependencies>['handleData']>>
>;

const getCssImportDeclarationsFromUnderscoreApp = async (
	parsedPath: ParsedPath,
	fileApi: FileAPI,
	tsmorph: Dependencies['tsmorph'],
): Promise<ReadonlyArray<string>> => {
	const underscodeAppJsxPath = posix.format({
		...parsedPath,
		name: '_app',
		ext: '.jsx',
		base: undefined,
	});

	const underscodeAppTsxPath = posix.format({
		...parsedPath,
		name: '_app',
		ext: '.tsx',
		base: undefined,
	});

	const path = fileApi.exists(underscodeAppJsxPath)
		? underscodeAppJsxPath
		: fileApi.exists(underscodeAppTsxPath)
		? underscodeAppTsxPath
		: null;

	if (path === null) {
		return [];
	}

	const data = await fileApi.readFile(path);

	const project = new tsmorph.Project({
		useInMemoryFileSystem: true,
		skipFileDependencyResolution: true,
		compilerOptions: {
			allowJs: true,
		},
	});

	const sourceFile = project.createSourceFile(path, data);

	return sourceFile
		.getImportDeclarations()
		.filter((importDeclaration) => {
			return importDeclaration
				.getModuleSpecifier()
				.getText()
				.includes('.css');
		})
		.map((importDeclaration) => importDeclaration.print());
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

		return moduleSpecifierText === moduleSpecifier;
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

export const replaceNextDocumentJsxTags = (sourceFile: SourceFile) => {
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
		}

		if (
			Node.isIdentifier(tagNameNode) &&
			['Html', 'Head'].includes(tagName)
		) {
			tagNameNode.rename(tagName.toLowerCase());
		}
	});
};

export const removeNextDocumentImport = (sourceFile: SourceFile) => {
	const importDeclarations = sourceFile.getImportDeclarations();

	const importDeclaration = importDeclarations.find((importDeclaration) => {
		const moduleSpecifierText = importDeclaration
			.getModuleSpecifier()
			.getText();

		return moduleSpecifierText === 'next/document';
	});

	importDeclaration?.remove();
};

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

export const repomod: Repomod<Dependencies> = {
	includePatterns: ['**/pages/**/*.{js,jsx,ts,tsx,cjs,mjs,mdx}'],
	excludePatterns: ['**/node_modules/**', '**/pages/api/**'],
	handleFile: async (api, path, options) => {
		const { tsmorph } = api.getDependencies();

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

			const cssImportDeclarations = (
				await getCssImportDeclarationsFromUnderscoreApp(
					parsedPath,
					api,
					tsmorph,
				)
			).join('\n');

			const commands: FileCommand[] = [
				{
					kind: 'upsertFile' as const,
					path: posix.format({
						root: parsedPath.root,
						dir: newDir,
						ext: EXTENSION,
						name: 'layout',
					}),
					options: {
						...options,
						filePurpose: FilePurpose.ROOT_LAYOUT,
						cssImportDeclarations,
					},
				},
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

			return [
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
	},
	handleData: async (api, path, __, options) => {
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
			(filePurpose === FilePurpose.ROOT_PAGE ||
				filePurpose === FilePurpose.ROUTE_PAGE) &&
			options.oldPath
		) {
			return buildPageFileData(api, path, options, filePurpose);
		}

		if (filePurpose === FilePurpose.ROOT_LAYOUT) {
			const { tsmorph } = api.getDependencies();

			const project = new tsmorph.Project({
				useInMemoryFileSystem: true,
				skipFileDependencyResolution: true,
				compilerOptions: {
					allowJs: true,
				},
			});

			const sourceFile = project.createSourceFile(path, content);

			const cssImportDeclarations = options.cssImportDeclarations ?? '';

			if (cssImportDeclarations !== '') {
				sourceFile.insertStatements(0, `${cssImportDeclarations}\n`);
			}

			return {
				kind: 'upsertData',
				path,
				data: sourceFile.print(),
			};
		}

		return {
			kind: 'upsertData',
			path,
			data: content,
		};
	},
};
