import { posix } from 'node:path';
import tsmorph from 'ts-morph';
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
import { Metadata } from 'next';
 
export const metadata: Metadata = {
	title: '',
	description: '',
};

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
	ROOT_NOT_FOUND = 'ROOT_NOT_FOUND',
	// route directories
	ROUTE_PAGE = 'ROUTE_PAGE',
}

const map = new Map([
	[FilePurpose.ROOT_LAYOUT, ROOT_LAYOUT_CONTENT],
	[FilePurpose.ROOT_ERROR, ROOT_ERROR_CONTENT],
	[FilePurpose.ROOT_NOT_FOUND, ROOT_NOT_FOUND_CONTENT],
	[FilePurpose.ROOT_PAGE, ''],
	[FilePurpose.ROUTE_PAGE, ''],
]);

const EXTENSION = '.tsx';

export const repomod: Repomod<Dependencies> = {
	includePatterns: ['**/pages/**/*.{js,jsx,ts,tsx,cjs,mjs,mdx}'],
	excludePatterns: ['**/node_modules/**', '**/pages/api/**'],
	handleFile: async (api, path, options) => {
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

			const commands = [
				{
					kind: 'upsertFile' as const,
					path: rootLayoutPath,
					options: {
						...options,
						filePurpose: FilePurpose.ROOT_LAYOUT,
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

			const routePagePath = posix.format({
				root: parsedPath.root,
				dir: newDir,
				ext: parsedPath.ext === '.mdx' ? '.mdx' : '.tsx',
				name: 'page',
			});

			const oldData = await api.readFile(path);

			return [
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

				oldSourceFile
					.getStatementsWithComments()
					.forEach((statement) => {
						if (tsmorph.Node.isImportDeclaration(statement)) {
							const structure = statement.getStructure();

							if (filePurpose === FilePurpose.ROUTE_PAGE) {
								if (
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

		return {
			kind: 'upsertData',
			path,
			data: content,
		};
	},
};
