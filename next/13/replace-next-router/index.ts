import {
	CallExpression,
	EmitHint,
	Identifier,
	ImportDeclaration,
	ImportSpecifier,
	VariableDeclaration,
} from 'ts-morph';
import { PropertyAccessExpression, SourceFile, ts } from 'ts-morph';
import { Node } from 'ts-morph';

// how to fix router events (manually)
// https://nextjs.org/docs/app/api-reference/functions/use-router#router-events

class FileLevelUsageManager {
	private __pathnameUsed: boolean = false;
	private __routerUsed: boolean = false;
	private __searchParamsUsed: boolean = false;
	private __paramsUsed: boolean = false;
	private __useRouterCount: number = 0;
	public useCallbackUsed: boolean = false;

	private __useRouterPresent: boolean;
	private __nextRouterPresent: boolean;
	private __useSearchParamsPresent: boolean;
	private __useParamsPresent: boolean;
	private __usePathnamePresent: boolean;

	public constructor(importDeclarations: ReadonlyArray<ImportDeclaration>) {
		this.__useRouterPresent = hasImport(
			importDeclarations,
			'next/router',
			'useRouter',
		);

		this.__nextRouterPresent = hasImport(
			importDeclarations,
			'next/router',
			'NextRouter',
		);

		this.__useSearchParamsPresent = hasImport(
			importDeclarations,
			'next/navigation',
			'useSearchParams',
		);

		this.__useParamsPresent = hasImport(
			importDeclarations,
			'next/navigation',
			'useParams',
		);

		this.__usePathnamePresent = hasImport(
			importDeclarations,
			'next/navigation',
			'usePathname',
		);
	}

	public increaseUseRouterCount(count: number): void {
		this.__useRouterCount += count;
	}

	public reportPathnameUsed() {
		this.__pathnameUsed = true;
	}

	public reportRouterUsed() {
		this.__routerUsed = true;
	}

	public reportSearchParamsUsed() {
		this.__searchParamsUsed = true;
	}

	public reportParamsUsed() {
		this.__paramsUsed = true;
	}

	public hasAnyNextRouterImport() {
		return this.__useRouterPresent || this.__nextRouterPresent;
	}

	public shouldImportUseRouter(): boolean {
		// TODO I don't understand this
		return this.__useRouterCount === 0 || this.__routerUsed;
	}

	public shouldImportUseSearchParams(): boolean {
		return this.__searchParamsUsed && !this.__useSearchParamsPresent;
	}

	public shouldImportUseParams(): boolean {
		return this.__paramsUsed && !this.__useParamsPresent;
	}

	public shouldImportUsePathname(): boolean {
		return this.__pathnameUsed && !this.__usePathnamePresent;
	}

	public shouldImportAppRouterInstance(): boolean {
		return this.__nextRouterPresent;
	}
}

class BlockLevelUsageManager {
	private __getParamUsed: boolean = false;
	private __getPathAsUsed: boolean = false;

	private __paramsUsed: boolean = false;
	private __searchParamsUsed: boolean = false;

	private __routerUsed: boolean = false;

	private __pathnames: Set<string> = new Set();
	private __labels: Array<string> = [];

	public constructor() {}

	public isRouterUsed(): boolean {
		return this.__routerUsed;
	}

	public areParamsUsed(): boolean {
		return this.__paramsUsed;
	}

	public areSearchParamsUsed(): boolean {
		return this.__searchParamsUsed;
	}

	public isGetParamsUsed(): boolean {
		return this.__getParamUsed;
	}

	public isGetPathAsUsed(): boolean {
		return this.__getPathAsUsed;
	}

	public getPathnames(): ReadonlySet<string> {
		return this.__pathnames;
	}

	public getLabels(): ReadonlyArray<string> {
		return this.__labels;
	}

	public addPathname(pathname: string): void {
		this.__pathnames.add(pathname);
	}

	public addLabel(label: string): void {
		this.__labels.push(label);

		this.reportGetParamUsage();
	}

	public reportGetPathAs(): void {
		this.__pathnames.add('pathname');

		this.__searchParamsUsed = true;
		this.__getPathAsUsed = true;
	}

	public reportGetParamUsage(): void {
		this.__paramsUsed = true;
		this.__searchParamsUsed = true;
		this.__getParamUsed = true;
	}

	public reportSearchParamsUsage(): void {
		this.__searchParamsUsed = true;
	}

	public reportRouterUsage(): void {
		this.__routerUsed = true;
	}
}

const hasImport = (
	importDeclarations: readonly ImportDeclaration[],
	moduleSpecifierText: string,
	namedImportText: string,
): boolean => {
	return importDeclarations.some((importDeclaration) => {
		const moduleSpecifier = importDeclaration.getModuleSpecifier();

		if (moduleSpecifier.getLiteralText() !== moduleSpecifierText) {
			return false;
		}

		return importDeclaration
			.getNamedImports()
			.some((namedImport) => namedImport.getName() === namedImportText);
	});
};

const handlePushCallExpression = (node: CallExpression) => {
	const grandParentNode = node.getParent();
	const arg = node.getArguments()[0];

	if (Node.isStringLiteral(arg)) {
		// remove `await` if it exists
		if (Node.isAwaitExpression(grandParentNode)) {
			const text = grandParentNode.getText();
			grandParentNode.replaceWithText(text.replace('await', ''));
		}
		// arg is already string. no further action required.
		return;
	}
	if (!Node.isObjectLiteralExpression(arg)) {
		return;
	}

	const block = node.getFirstAncestorByKind(ts.SyntaxKind.Block);
	const pathnameNode = arg.getProperty('pathname');

	if (
		!block ||
		!Node.isExpressionStatement(grandParentNode) ||
		!Node.isPropertyAssignment(pathnameNode) // `pathname` is required
	) {
		return;
	}

	const pathNameValue = pathnameNode.getInitializer()?.getText() ?? '';
	const prevSiblingNodeCount = node.getPreviousSiblings().length;
	const queryNode = arg.getProperty('query');

	let newText = ``;
	let newArgText = ``;
	if (Node.isPropertyAssignment(queryNode)) {
		newText += `const urlSearchParams = new URLSearchParams();\n`;

		const initializer = queryNode.getInitializer();
		if (Node.isObjectLiteralExpression(initializer)) {
			const properties = initializer.getProperties();

			properties.forEach((property) => {
				if (Node.isPropertyAssignment(property)) {
					const name = property.getNameNode();
					const initializer = property.getInitializer();
					newText += `\n urlSearchParams.set('${name.getText()}', ${initializer?.getText()});`;
				}
			});

			newArgText = `\`${pathNameValue.replace(
				/("|')/g,
				'',
			)}?\${urlSearchParams.toString()}\``;
		}
	} else {
		newArgText = pathNameValue;
	}

	block.insertStatements(prevSiblingNodeCount + 1, newText);
	arg.replaceWithText(newArgText);
	// remove original `router.replace(...)` or `router.push(...)`
	// grandParentNode.remove();
};

// e.g. router.query
const handleRouterPropertyAccessExpression = (
	blockLevelUsageManager: BlockLevelUsageManager,
	node: PropertyAccessExpression,
) => {
	const nodeName = node.getName();

	if (nodeName === 'query') {
		const parentNode = node.getParent();

		if (Node.isPropertyAccessExpression(parentNode)) {
			// e.g. router.query.a
			const parentNodeName = parentNode.getName();

			parentNode.replaceWithText(`getParam("${parentNodeName}")`);

			blockLevelUsageManager.reportGetParamUsage();
		} else if (Node.isSpreadAssignment(parentNode)) {
			parentNode.replaceWithText(
				`...Object.fromEntries(searchParams ?? new URLSearchParams())`,
			);

			blockLevelUsageManager.reportSearchParamsUsage();
		} else if (Node.isVariableDeclaration(parentNode)) {
			const variableDeclarationName = parentNode.getNameNode();

			if (Node.isObjectBindingPattern(variableDeclarationName)) {
				const bindingPatternText = variableDeclarationName.getText();

				const vdl = parentNode.getFirstAncestorByKind(
					ts.SyntaxKind.VariableDeclarationList,
				);

				vdl?.addDeclaration({
					name: bindingPatternText,
					initializer: `Object.fromEntries(searchParams?.entries() ?? [])`,
				});

				parentNode.remove();

				blockLevelUsageManager.reportSearchParamsUsage();
			}
		} else if (Node.isCallExpression(parentNode)) {
			node.replaceWithText(
				'...Object.fromEntries(searchParams ?? new URLSearchParams())',
			);
			blockLevelUsageManager.reportSearchParamsUsage();
		} else if (Node.isElementAccessExpression(parentNode)) {
			// e.g. router.query["param"]

			const argumentExpressionAsText = parentNode
				.getArgumentExpression()
				?.getText();

			if (!argumentExpressionAsText) {
				return;
			}

			const replacerText = `getParam(${argumentExpressionAsText})`;

			parentNode.replaceWithText(replacerText);

			blockLevelUsageManager.reportGetParamUsage();
		} else {
			node.replaceWithText('searchParams');
			blockLevelUsageManager.reportSearchParamsUsage();
		}
	} else if (nodeName === 'pathname') {
		const parentNode = node.getParent();

		if (Node.isVariableDeclaration(parentNode)) {
			parentNode.remove();
		} else if (Node.isPropertyAccessExpression(parentNode)) {
			const rightNode = parentNode.getName();

			parentNode.replaceWithText(`pathname?.${rightNode}`);
		} else {
			node.replaceWithText('pathname');
		}

		blockLevelUsageManager.addPathname('pathname');
	} else if (nodeName === 'isReady') {
		blockLevelUsageManager.reportSearchParamsUsage();

		try {
			// replacing `router.isReady`
			node.replaceWithText('searchParams !== null');
		} catch (_err) {
			// replacing `!router.isReady`
			const parentNode = node.getParent();
			const grandParentNode = parentNode?.getParent() ?? null;
			if (grandParentNode === null) {
				return;
			}

			if (Node.isVariableDeclaration(grandParentNode)) {
				// replacing `const var = !router.isReady`
				const initializer = grandParentNode.getInitializer();
				if (
					Node.isPrefixUnaryExpression(initializer) &&
					initializer.getOperatorToken() ===
						ts.SyntaxKind.ExclamationToken
				) {
					initializer.replaceWithText('searchParams === null');
				}
			} else if (Node.isIfStatement(grandParentNode)) {
				// replacing `if (!router.isReady)`
				const condition = grandParentNode.getExpression();

				if (
					Node.isPrefixUnaryExpression(condition) &&
					condition.getOperatorToken() ===
						ts.SyntaxKind.ExclamationToken
				) {
					condition.replaceWithText('searchParams === null');
				}
			} else if (Node.isConditionalExpression(grandParentNode)) {
				// replacing `if (!router.isReady)`

				const condition = grandParentNode.getCondition();

				if (
					Node.isPrefixUnaryExpression(condition) &&
					condition.getOperatorToken() ===
						ts.SyntaxKind.ExclamationToken
				) {
					const operand = condition.getOperand();
					if (
						Node.isPropertyAccessExpression(operand) &&
						operand.getText() === 'router.isReady'
					) {
						condition.replaceWithText('searchParams === null');
					}
				}
			}
		}
	} else if (nodeName === 'asPath') {
		const parentNode = node.getParent();

		if (Node.isPropertyAccessExpression(parentNode)) {
			const rightNode = parentNode.getName();

			parentNode.replaceWithText(`getPathAs().${rightNode}`);
		} else {
			node.replaceWithText('getPathAs()');
		}

		blockLevelUsageManager.reportGetPathAs();
	} else if (nodeName === 'href') {
		node.replaceWithText('pathname');

		blockLevelUsageManager.addPathname('pathname');
	} else if (nodeName === 'isFallback') {
		node.replaceWithText('false');
	} else if (nodeName === 'replace' || nodeName === 'push') {
		blockLevelUsageManager.reportRouterUsage();

		const parentNode = node.getParent();
		if (Node.isCallExpression(parentNode)) {
			handlePushCallExpression(parentNode);
		}
	} else {
		// unrecognized node names
		blockLevelUsageManager.reportRouterUsage();
	}
};

const handleQueryIdentifierNode = (
	node: Identifier,
	blockLevelUsageManager: BlockLevelUsageManager,
) => {
	const parent = node.getParent();

	if (Node.isPropertyAccessExpression(parent)) {
		const name = parent.getName();

		parent.replaceWithText(`getParam('${name}')`);

		blockLevelUsageManager.reportGetParamUsage();
	} else if (Node.isVariableDeclaration(parent)) {
		const variableDeclaration = parent;

		const nameNode = variableDeclaration.getNameNode();

		if (Node.isObjectBindingPattern(nameNode)) {
			const objectBindingPattern = nameNode;
			const elements = objectBindingPattern.getElements();

			const labels: string[] = [];

			elements.forEach((element) => {
				const nameNode = element.getNameNode();

				if (Node.isIdentifier(nameNode)) {
					labels.push(nameNode.getText());
				}
			});

			variableDeclaration.remove();

			labels.forEach((label) => {
				blockLevelUsageManager.addLabel(label);
			});
		}
	} else if (Node.isCallExpression(parent)) {
		node.replaceWithText('searchParams');

		blockLevelUsageManager.reportSearchParamsUsage();
	} else if (Node.isElementAccessExpression(parent)) {
		const expression = parent.getArgumentExpression();

		if (Node.isStringLiteral(expression)) {
			parent.replaceWithText(`getParam(${expression.getText()})`);

			blockLevelUsageManager.reportGetParamUsage();
		}
	}
};

const handleVariableDeclarationWithRouter = (
	variableDeclaration: VariableDeclaration,
	blockLevelUsageManager: BlockLevelUsageManager,
) => {
	const nameNode = variableDeclaration.getNameNode();

	if (Node.isObjectBindingPattern(nameNode)) {
		const elements = nameNode.getElements();
		let count = 0;

		for (const element of elements) {
			const nameNode = element.getNameNode();
			const propertyNameNode = element.getPropertyNameNode() ?? nameNode;

			if (Node.isIdentifier(propertyNameNode)) {
				if (propertyNameNode.getText() === 'pathname') {
					blockLevelUsageManager.addPathname(nameNode.getText());

					++count;
				} else if (propertyNameNode.getText() === 'query') {
					propertyNameNode
						.findReferencesAsNodes()
						.forEach((referenceNode) => {
							const parent = referenceNode.getParent();

							if (Node.isPropertyAccessExpression(parent)) {
								const nameNode = parent.getNameNode();

								if (Node.isIdentifier(nameNode)) {
									parent.replaceWithText(
										`getParam("${nameNode.getText()}")`,
									);

									blockLevelUsageManager.reportGetParamUsage();
								}
							} else if (Node.isArrayLiteralExpression(parent)) {
								referenceNode.replaceWithText('searchParams');
								blockLevelUsageManager.reportSearchParamsUsage();
							}
						});

					++count;
				}
			}
		}

		if (count === elements.length) {
			variableDeclaration.remove();
			return;
		}
	}

	blockLevelUsageManager.reportRouterUsage();
};

const handleVariableDeclaration = (
	blockLevelUsageManager: BlockLevelUsageManager,
	variableDeclaration: VariableDeclaration,
) => {
	const bindingName = variableDeclaration.getNameNode();

	if (Node.isIdentifier(bindingName)) {
		bindingName.findReferencesAsNodes().forEach((node) => {
			const parent = node.getParent();

			if (Node.isPropertyAccessExpression(parent)) {
				handleRouterPropertyAccessExpression(
					blockLevelUsageManager,
					parent,
				);
			} else if (Node.isVariableDeclaration(parent)) {
				handleVariableDeclarationWithRouter(
					parent,
					blockLevelUsageManager,
				);
			} else if (Node.isArrayLiteralExpression(parent)) {
				blockLevelUsageManager.reportRouterUsage();
			} else if (Node.isShorthandPropertyAssignment(parent)) {
				blockLevelUsageManager.reportRouterUsage();
			}
		});

		const referenceCount = bindingName.findReferencesAsNodes().length;

		if (referenceCount === 0) {
			variableDeclaration.remove();
			return;
		}
	}

	if (Node.isObjectBindingPattern(bindingName)) {
		const elements = bindingName.getElements();
		let count = 0;

		for (const element of elements) {
			const nameNode = element.getNameNode();

			if (Node.isIdentifier(nameNode)) {
				const text = nameNode.getText();

				if (text === 'query') {
					nameNode.findReferencesAsNodes().forEach((node) => {
						if (Node.isIdentifier(node)) {
							handleQueryIdentifierNode(
								node,
								blockLevelUsageManager,
							);
						}
					});

					++count;
				} else if (text === 'locale') {
					++count;
				} else if (text === 'pathname' || text === 'route') {
					blockLevelUsageManager.addPathname(text);

					++count;
				} else if (text === 'isReady') {
					blockLevelUsageManager.reportSearchParamsUsage();

					nameNode.findReferencesAsNodes().forEach((node) => {
						node.replaceWithText('searchParams !== null');
					});

					++count;
				} else if (text === 'asPath') {
					++count;

					nameNode.findReferencesAsNodes().forEach((node) => {
						const parentNode = node.getParent();

						if (Node.isPropertyAccessExpression(parentNode)) {
							const rightNode = parentNode.getName();

							parentNode.replaceWithText(
								`getPathAs().${rightNode}`,
							);
						} else {
							node.replaceWithText('getPathAs(');
						}
					});

					blockLevelUsageManager.reportGetPathAs();
				} else if (text === 'push' || text === 'replace') {
					nameNode.findReferencesAsNodes().forEach((node) => {
						const parent = node.getParent();

						if (Node.isCallExpression(parent)) {
							handlePushCallExpression(parent);
						}
					});

					blockLevelUsageManager.reportRouterUsage();
				}
			} else if (Node.isObjectBindingPattern(nameNode)) {
				const elements = nameNode.getElements();

				const labels: string[] = [];

				elements.forEach((element) => {
					const nameNode = element.getNameNode();

					if (Node.isIdentifier(nameNode)) {
						labels.push(nameNode.getText());
					}
				});

				labels.forEach((label) => {
					blockLevelUsageManager.addLabel(label);
				});

				++count;
			}
		}

		if (elements.length === count) {
			variableDeclaration.remove();

			return;
		}
	}
};

const handleUseRouterCallExpression = (
	blockLevelUsageManager: BlockLevelUsageManager,
	node: CallExpression,
) => {
	const parent = node.getParent();

	if (Node.isVariableDeclaration(parent)) {
		handleVariableDeclaration(blockLevelUsageManager, parent);
	} else if (Node.isPropertyAccessExpression(parent)) {
		const nameNode = parent.getNameNode();
		const grandparent = parent.getParent();

		if (!Node.isIdentifier(nameNode)) {
			return;
		}

		const text = nameNode.getText();

		if (text === 'isReady') {
			blockLevelUsageManager.reportSearchParamsUsage();
			parent.replaceWithText('searchParams !== null');
		} else if (text === 'pathname') {
			blockLevelUsageManager.addPathname('pathname');

			const grandparent = parent.getParent();

			if (Node.isVariableDeclaration(grandparent)) {
				grandparent.remove();
			}
		} else if (text === 'query') {
			if (Node.isCallExpression(grandparent)) {
				parent.replaceWithText(
					`...Object.fromEntries(searchParams ?? new URLSearchParams())`,
				);

				blockLevelUsageManager.reportSearchParamsUsage();
			} else if (Node.isElementAccessExpression(grandparent)) {
				const argumentExpression = grandparent.getArgumentExpression();

				grandparent.replaceWithText(
					`getParam(${argumentExpression?.print()})`,
				);

				blockLevelUsageManager.reportGetParamUsage();
			} else if (Node.isPropertyAccessExpression(grandparent)) {
				const nameNode = grandparent.getNameNode();

				if (Node.isIdentifier(nameNode)) {
					grandparent.replaceWithText(
						`getParam("${nameNode.getText()}")`,
					);

					blockLevelUsageManager.reportGetParamUsage();
				}
			} else if (Node.isAsExpression(grandparent)) {
				const greatgrandparent = grandparent.getParent();

				if (Node.isVariableDeclaration(greatgrandparent)) {
					const bindingName = greatgrandparent.getNameNode();

					if (Node.isObjectBindingPattern(bindingName)) {
						const elements = bindingName.getElements();

						const properties: {
							name: string;
							propertyName: string;
						}[] = [];

						for (const element of elements) {
							const nameNode = element.getNameNode();
							const propertyNameNode =
								element.getPropertyNameNode() ?? nameNode;

							if (
								Node.isIdentifier(nameNode) &&
								Node.isIdentifier(propertyNameNode)
							) {
								properties.push({
									name: nameNode.getText(),
									propertyName: propertyNameNode.getText(),
								});
							}
						}

						const text = properties
							.map(({ name, propertyName }) => {
								return `${name} = getParam("${propertyName}")`;
							})
							.join(',\n');

						greatgrandparent.replaceWithText(text);

						blockLevelUsageManager.reportGetParamUsage();
					}
				}
			} else {
				parent.replaceWithText('searchParams');
			}
		} else if (text === 'isFallback') {
			parent.replaceWithText('false');
		} else if (text === 'asPath') {
			if (Node.isVariableDeclaration(grandparent)) {
				grandparent.findReferencesAsNodes().forEach((reference) => {
					if (Node.isIdentifier(reference)) {
						const parentNode = reference.getParent();

						if (Node.isPropertyAccessExpression(parentNode)) {
							const parentNodeName = parentNode.getName();

							parentNode.replaceWithText(
								`getPathAs().${parentNodeName}`,
							);
						}
					}
				});

				grandparent.remove();

				blockLevelUsageManager.reportGetPathAs();
			}
		}
	}
};

const handleUseRouterIdentifier = (
	fileLevelUsageManager: FileLevelUsageManager,
	node: Identifier,
) => {
	const block = node.getFirstAncestorByKind(ts.SyntaxKind.Block);

	if (block === undefined) {
		return;
	}

	const blockLevelUsageManager = new BlockLevelUsageManager();

	const parent = node.getParent();

	if (Node.isCallExpression(parent)) {
		handleUseRouterCallExpression(blockLevelUsageManager, parent);
	}

	const statements: string[] = [];

	if (blockLevelUsageManager.isRouterUsed()) {
		fileLevelUsageManager.reportRouterUsed();
	}

	if (blockLevelUsageManager.areParamsUsed()) {
		statements.push('const params = useParams();');

		fileLevelUsageManager.reportParamsUsed();
	}

	if (blockLevelUsageManager.areSearchParamsUsed()) {
		statements.push('const searchParams = useSearchParams();');

		fileLevelUsageManager.reportSearchParamsUsed();
	}

	for (const pathname of blockLevelUsageManager.getPathnames()) {
		statements.push(`const ${pathname} = usePathname();`);

		fileLevelUsageManager.reportPathnameUsed();
	}

	if (blockLevelUsageManager.isGetParamsUsed()) {
		statements.push(
			'const getParam = useCallback((p: string) => params[p] ?? searchParams.get(p), [params, searchParams]);',
		);

		fileLevelUsageManager.useCallbackUsed = true;
	}

	if (blockLevelUsageManager.isGetPathAsUsed()) {
		statements.push(
			'const getPathAs = useCallback(() => `${pathname}?${searchParams.toString() ?? ""}`, [pathname, searchParams]);',
		);

		fileLevelUsageManager.useCallbackUsed = true;
	}

	for (const label of blockLevelUsageManager.getLabels()) {
		statements.push(`const ${label} = getParam("${label}")`);
	}

	block.insertStatements(0, statements);
};

const handleNextRouterNamedImport = (namedImport: ImportSpecifier): void => {
	namedImport
		.getNameNode()
		.findReferencesAsNodes()
		.forEach((node) => {
			if (Node.isIdentifier(node)) {
				node.replaceWithText('AppRouterInstance');
			}
		});
};

const handleImportDeclaration = (
	fileLevelUsageManager: FileLevelUsageManager,
	importDeclaration: ImportDeclaration,
) => {
	const moduleSpecifier = importDeclaration.getModuleSpecifier();

	if (moduleSpecifier.getLiteralText() !== 'next/router') {
		return;
	}

	importDeclaration.getNamedImports().forEach((namedImport) => {
		if (namedImport.getName() === 'NextRouter') {
			handleNextRouterNamedImport(namedImport);
		}

		if (namedImport.getName() === 'useRouter') {
			namedImport
				.getNameNode()
				.findReferencesAsNodes()
				.forEach((node) => {
					if (!Node.isIdentifier(node)) {
						return;
					}

					handleUseRouterIdentifier(fileLevelUsageManager, node);
				});
		}

		const referenceCount = namedImport
			.getNameNode()
			.findReferencesAsNodes().length;

		if (referenceCount === 0) {
			namedImport.remove();
		}

		fileLevelUsageManager.increaseUseRouterCount(referenceCount);
	});

	importDeclaration.remove();
};

export const handleSourceFile = (
	sourceFile: SourceFile,
): string | undefined => {
	const importDeclarations = sourceFile.getImportDeclarations();

	const fileLevelUsageManager = new FileLevelUsageManager(importDeclarations);

	if (!fileLevelUsageManager.hasAnyNextRouterImport()) {
		return undefined;
	}

	importDeclarations.forEach((importDeclaration) =>
		handleImportDeclaration(fileLevelUsageManager, importDeclaration),
	);

	if (fileLevelUsageManager.useCallbackUsed) {
		const importDeclaration =
			sourceFile
				.getImportDeclarations()
				.find(
					(importDeclaration) =>
						importDeclaration.getModuleSpecifierValue() === 'react',
				) ?? null;

		if (importDeclaration === null) {
			sourceFile.addImportDeclaration({
				moduleSpecifier: 'react',
				namedImports: [
					{
						name: 'useCallback',
					},
				],
			});
		} else {
			importDeclaration.addNamedImport('useCallback');
		}
	}

	const namedImports = [
		fileLevelUsageManager.shouldImportUseParams() ? 'useParams' : null,
		fileLevelUsageManager.shouldImportUsePathname() ? 'usePathname' : null,
		fileLevelUsageManager.shouldImportUseRouter() ? 'useRouter' : null,
		fileLevelUsageManager.shouldImportUseSearchParams()
			? 'useSearchParams'
			: null,
	]
		.filter((x): x is string => x !== null)
		.sort();

	if (namedImports.length > 0) {
		sourceFile.insertStatements(
			0,
			`import { ${namedImports.join(', ')} } from "next/navigation";`,
		);
	}

	if (fileLevelUsageManager.shouldImportAppRouterInstance()) {
		sourceFile.insertStatements(
			0,
			'import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context";',
		);
	}

	return sourceFile.print({ emitHint: EmitHint.SourceFile });
};
