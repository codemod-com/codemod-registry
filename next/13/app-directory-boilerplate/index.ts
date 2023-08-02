import { ParsedPath, posix } from 'node:path';
import tsmorph, { SyntaxKind } from 'ts-morph';
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

const ROUTE_NOT_FOUND_COMPONENT = `
'use client';
import ErrorPage from 'next/error';

const NotFound = () => <ErrorPage statusCode={404} />;

export default NotFound;
`;

enum FilePurpose {
	// root directory
	ROOT_LAYOUT = 'ROOT_LAYOUT',
	ROOT_ERROR = 'ROOT_ERROR',
	ROOT_PAGE = 'ROOT_PAGE',
	ROOT_NOT_FOUND = 'ROOT_NOT_FOUND',
	// route directories
	ROUTE_PAGE = 'ROUTE_PAGE',
	ROUTE_NOT_FOUND_COMPONENT = 'ROUTE_NOT_FOUND_COMPONENT',
}

const map = new Map([
	[FilePurpose.ROOT_LAYOUT, ROOT_LAYOUT_CONTENT],
	[FilePurpose.ROOT_ERROR, ROOT_ERROR_CONTENT],
	[FilePurpose.ROOT_NOT_FOUND, ROOT_NOT_FOUND_CONTENT],
	[FilePurpose.ROOT_PAGE, ''],
	[FilePurpose.ROUTE_PAGE, ''],
	[FilePurpose.ROUTE_NOT_FOUND_COMPONENT, ROUTE_NOT_FOUND_COMPONENT],
]);

const EXTENSION = '.tsx';

type FileAPI = Parameters<NonNullable<Repomod<Dependencies>['handleFile']>>[0];

type Unpromisify<T> = T extends Promise<infer U> ? U : never;

type FileCommand = Unpromisify<
	ReturnType<NonNullable<Repomod<Dependencies>['handleFile']>>
>[number];

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

			const rootLayoutPath = posix.format({
				root: parsedPath.root,
				dir: newDir,
				ext: EXTENSION,
				name: 'layout',
			});

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
					path: rootLayoutPath,
					options: {
						...options,
						filePurpose: FilePurpose.ROOT_LAYOUT,
						cssImportDeclarations,
					},
				},
				{
					kind: 'upsertFile' as const,
					path: rootPagePath,
					options: {
						...options,
						filePurpose: FilePurpose.ROOT_PAGE,
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

			if (oldData.includes('next/error')) {
				const notFoundPath = posix.format({
					root: parsedPath.root,
					dir: newDir,
					ext: '.tsx',
					name: 'notFound',
				});

				commands.push({
					kind: 'upsertFile' as const,
					path: notFoundPath,
					options: {
						...options,
						filePurpose: FilePurpose.ROUTE_NOT_FOUND_COMPONENT,
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

			const routePagePath = posix.format({
				root: parsedPath.root,
				dir: newDir,
				ext: parsedPath.ext === '.mdx' ? '.mdx' : '.tsx',
				name: 'page',
			});

			const oldData = await api.readFile(path);

			const commands: FileCommand[] = [
				{
					kind: 'upsertFile',
					path: routePagePath,
					options: {
						...options,
						filePurpose: FilePurpose.ROUTE_PAGE,
						oldPath: path,
						oldData,
					},
				},
				{
					kind: 'deleteFile' as const,
					path,
				},
			];

			if (oldData.includes('next/error')) {
				const notFoundPath = posix.format({
					root: parsedPath.root,
					dir: newDir,
					ext: '.tsx',
					name: 'notFound',
				});

				commands.push({
					kind: 'upsertFile',
					path: notFoundPath,
					options: {
						...options,
						filePurpose: FilePurpose.ROUTE_NOT_FOUND_COMPONENT,
					},
				});
			}

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
			(filePurpose === FilePurpose.ROUTE_PAGE ||
				filePurpose === FilePurpose.ROOT_PAGE) &&
			options.oldPath
		) {
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

				const newSourceFile = project.createSourceFile(path, content);

				const oldSourceFile = project.createSourceFile(
					options.oldPath ?? '',
					input,
				);

				oldSourceFile.getFunctions().forEach((fn) => {
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

				oldSourceFile.getVariableStatements().forEach((statement) => {
					const declarations = statement.getDeclarations();

					declarations.forEach((declaration) => {
						const id = declaration.getName() ?? '';

						if (
							[
								'getStaticProps',
								'getServerSideProps',
								'getStaticPaths',
							].includes(id)
						) {
							if (declaration.hasExportKeyword()) {
								statement.setIsExported(false);
							}
						}
					});
				});

				oldSourceFile
					.getImportDeclarations()
					.filter((declaration) => {
						return (
							declaration
								.getModuleSpecifier()
								.getLiteralText() === 'next/head' &&
							declaration.getImportClause()?.getText() === 'Head'
						);
					})
					.forEach((declaration) => {
						declaration.remove();
					});

				oldSourceFile
					.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
					.filter(
						(jsxOpeningElement) =>
							jsxOpeningElement.getTagNameNode().getText() ===
							'Head',
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
							parenthesizedExpressionParent.replaceWithText(
								'null',
							);

							return;
						}

						jsxElement?.replaceWithText('');
					});

				let nextErrorComponentName = '';

				oldSourceFile
					.getImportDeclarations()
					.filter((declaration) => {
						return (
							declaration
								.getModuleSpecifier()
								.getLiteralText() === 'next/error'
						);
					})
					.forEach((declaration) => {
						nextErrorComponentName =
							declaration.getImportClause()?.getText() ?? '';

						declaration.remove();
					});

				if (nextErrorComponentName !== '') {
					oldSourceFile
						.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
						.filter((element) => {
							return (
								element.getTagNameNode().getText() ===
									nextErrorComponentName &&
								element
									.getAttributes()
									.some(({ compilerNode }) => {
										return (
											compilerNode.kind ===
												SyntaxKind.JsxAttribute &&
											compilerNode.name.getText() ===
												'statusCode' &&
											compilerNode.initializer?.kind ===
												SyntaxKind.JsxExpression &&
											compilerNode.initializer.expression?.getText() ===
												'404'
										);
									})
							);
						})
						.forEach((element) => {
							element.replaceWithText('<NotFound />');

							oldSourceFile.addImportDeclaration({
								moduleSpecifier: './notFound',
								defaultImport: 'NotFound',
							});
						});
				}

				oldSourceFile
					.getStatementsWithComments()
					.forEach((statement) => {
						if (tsmorph.Node.isImportDeclaration(statement)) {
							const structure = statement.getStructure();

							if (filePurpose === FilePurpose.ROUTE_PAGE) {
								if (
									structure.moduleSpecifier !==
										'./notFound' &&
									structure.moduleSpecifier.startsWith('./')
								) {
									structure.moduleSpecifier = `.${structure.moduleSpecifier}`;
								} else if (
									structure.moduleSpecifier.startsWith('../')
								) {
									structure.moduleSpecifier = `../${structure.moduleSpecifier}`;
								}
							}

							newSourceFile.addImportDeclaration(structure);

							return;
						}

						if (tsmorph.Node.isVariableStatement(statement)) {
							const declarations = statement
								.getDeclarationList()
								.getDeclarations();

							const getStaticPathUsed = declarations.some(
								(declaration) => {
									return (
										declaration.getName() ===
										'getStaticPath'
									);
								},
							);

							if (getStaticPathUsed) {
								newSourceFile.addStatements(
									`// TODO reimplement getStaticPath as generateStaticParams\n`,
								);
							}

							const getServerSidePropsUsed = declarations.some(
								(declaration) => {
									return (
										declaration.getName() ===
										'getServerSideProps'
									);
								},
							);

							if (getServerSidePropsUsed) {
								newSourceFile.addStatements(
									`// TODO reimplement getServerSideProps with custom logic\n`,
								);
							}
						}

						newSourceFile.addStatements(statement.print());
					});

				if (!sourcingStatementInserted) {
					newSourceFile.insertStatements(
						0,
						`// This file has been sourced from: ${options.oldPath}`,
					);

					sourcingStatementInserted = true;
				}

				return newSourceFile.print();
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

			const data = rewriteWithTsMorph(options.oldData ?? '');

			return {
				kind: 'upsertData',
				path,
				data,
			};
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
