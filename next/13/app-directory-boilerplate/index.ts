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
	ImportDeclaration,
	VariableStatement,
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
	// root directory
	[FilePurpose.ROOT_LAYOUT, ''],
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

type Unpromisify<T> = T extends Promise<infer U> ? U : never;

type FileCommand = Unpromisify<
	ReturnType<NonNullable<Repomod<Dependencies>['handleFile']>>
>[number];

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

const extractStatements = (sourceFile: SourceFile) => {
	const statements = sourceFile.getStatements();

	const exportAssignment = statements.find((s) => Node.isExportAssignment(s));
	const exportedIdentifierName = exportAssignment
		?.getFirstDescendantByKind(SyntaxKind.Identifier)
		?.getText();

	let component:
		| ArrowFunction
		| FunctionExpression
		| FunctionDeclaration
		| undefined;

	const functionDeclarations: FunctionDeclaration[] = [];
	const importDeclarations: ImportDeclaration[] = [];
	const variableStatements: VariableStatement[] = [];

	statements.forEach((s) => {
		if (Node.isExportAssignment(s)) {
			return;
		}

		if (Node.isImportDeclaration(s)) {
			importDeclarations.push(s);
		}

		if (Node.isVariableStatement(s)) {
			const declaration = s.getFirstDescendantByKind(
				SyntaxKind.VariableDeclaration,
			);
			const initializer = declaration?.getInitializer();

			if (
				declaration?.getName() === exportedIdentifierName &&
				(Node.isArrowFunction(initializer) ||
					Node.isFunctionExpression(initializer))
			) {
				component = initializer;
				return;
			}

			variableStatements.push(s);
		}

		if (Node.isFunctionDeclaration(s)) {
			if (s.isDefaultExport() || s.getName() === exportedIdentifierName) {
				component = s;
				return;
			}

			functionDeclarations.push(s);
		}
	});

	const returnStatement = component?.getFirstDescendantByKind(
		SyntaxKind.ReturnStatement,
	);

	returnStatement
		?.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
		.find(
			(jsxElement) =>
				jsxElement.getTagNameNode().getText() === 'Component',
		)
		?.replaceWithText('{ children }');

	return {
		functionDeclarations: functionDeclarations.map((f) => f.getText()),
		importDeclarations: importDeclarations.map((f) => f.getText()),
		variableStatements: variableStatements.map((v) => v.getText()),
		returnExpression: returnStatement?.getExpression()?.getText(),
	};
};

const getPositionAfterImports = (sourceFile: SourceFile): number => {
	const lastImportDeclaration =
		sourceFile.getLastChildByKind(SyntaxKind.ImportDeclaration) ?? null;

	return (lastImportDeclaration?.getChildIndex() ?? 0) + 1;
};

const injectStatements = (
	sourceFile: SourceFile,
	functionDeclarations: string[],
	importDeclarations: string[],
	variableDeclarations: string[],
	returnStatement: string,
) => {
	const mainJsxTag = sourceFile
		.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
		.find((jsxElement) => jsxElement.getTagNameNode().getText() === 'Main');

	mainJsxTag?.replaceWithText(returnStatement);

	sourceFile.insertStatements(0, importDeclarations.join('\n'));

	const positionAfterImports = getPositionAfterImports(sourceFile);

	sourceFile.insertStatements(
		positionAfterImports,
		functionDeclarations.join('\n'),
	);
	sourceFile.insertStatements(
		positionAfterImports,
		variableDeclarations.join('\n'),
	);
};

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

			const commands: FileCommand[] = [
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
					path: rootLayoutPath,
					options: {
						...options,
						underscoreDocumentPath,
						underscoreDocumentData,
						underscoreAppPath,
						underscoreAppData,
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

		if (
			filePurpose === FilePurpose.ROOT_LAYOUT &&
			options.underscoreDocumentData &&
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

			const {
				functionDeclarations,
				importDeclarations,
				variableStatements,
				returnExpression,
			} = extractStatements(underscoreAppFile);

			const sourceFile = project.createSourceFile(
				path,
				options.underscoreDocumentData,
			);

			replaceNextDocumentJsxTags(sourceFile);
			removeNextDocumentImport(sourceFile);
			updateLayoutComponent(sourceFile);
			injectStatements(
				sourceFile,
				functionDeclarations,
				importDeclarations,
				variableStatements,
				returnExpression ?? '{ children }',
			);

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
