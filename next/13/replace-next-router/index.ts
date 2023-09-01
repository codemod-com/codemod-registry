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

export const buildContainer = <T>(initialValue: T) => {
	let currentValue: T = initialValue;

	const get = (): T => {
		return currentValue;
	};

	const set = (callback: (previousValue: T) => T): void => {
		currentValue = callback(currentValue);
	};

	return {
		get,
		set,
	};
};

type Container<T> = ReturnType<typeof buildContainer<T>>;

class FileLevelUsageManager {
	private __pathnameUsed: Container<boolean> = buildContainer<boolean>(false);
	private __routerUsed: Container<boolean> = buildContainer<boolean>(false);
	private __searchParamsUsed: Container<boolean> =
		buildContainer<boolean>(false);
	private __useRouterCount = buildContainer<number>(0);

	private __useRouterPresent: boolean;
	private __nextRouterPresent: boolean;
	private __useSearchParamsPresent: boolean;
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

		this.__usePathnamePresent = hasImport(
			importDeclarations,
			'next/navigation',
			'usePathname',
		);
	}

	public increaseUseRouterCount(count: number): void {
		this.__useRouterCount.set((previousCount) => previousCount + count);
	}

	public reportPathnameUsed() {
		this.__pathnameUsed.set(() => true);
	}

	public reportRouterUsed() {
		this.__routerUsed.set(() => true);
	}

	public reportSearchParamsUsed() {
		this.__searchParamsUsed.set(() => true);
	}

	public hasAnyNextRouterImport() {
		return this.__useRouterPresent || this.__nextRouterPresent;
	}

	public shouldImportUseRouter(): boolean {
		// TODO I don't understand this
		return this.__useRouterCount.get() === 0 || this.__routerUsed.get();
	}

	public shouldImportUseSearchParams(): boolean {
		return this.__searchParamsUsed.get() && !this.__useSearchParamsPresent;
	}

	public shouldImportUsePathname(): boolean {
		return this.__pathnameUsed.get() && !this.__usePathnamePresent;
	}

	public shouldImportAppRouterInstance(): boolean {
		return this.__nextRouterPresent;
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
	node: PropertyAccessExpression,
	onReplacedWithSearchParams: () => void,
	usesRouter: Container<boolean>,
	onReplacedWithPathname: () => void,
) => {
	const nodeName = node.getName();

	if (nodeName === 'query') {
		const parentNode = node.getParent();

		if (Node.isPropertyAccessExpression(parentNode)) {
			// e.g. router.query.a
			const parentNodeName = parentNode.getName();

			parentNode.replaceWithText(
				`searchParams?.get("${parentNodeName}")`,
			);

			onReplacedWithSearchParams();
		} else if (Node.isSpreadAssignment(parentNode)) {
			parentNode.replaceWithText(
				`...Object.fromEntries(searchParams ?? new URLSearchParams())`,
			);

			onReplacedWithSearchParams();
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

				onReplacedWithSearchParams();
			}
		} else if (Node.isCallExpression(parentNode)) {
			node.replaceWithText(
				'...Object.fromEntries(searchParams ?? new URLSearchParams())',
			);
			onReplacedWithSearchParams();
		} else if (Node.isElementAccessExpression(parentNode)) {
			// e.g. router.query["param"]

			const argumentExpressionAsText = parentNode
				.getArgumentExpression()
				?.getText();

			if (!argumentExpressionAsText) {
				return;
			}

			const replacerText = `searchParams?.get(${argumentExpressionAsText})`;

			parentNode.replaceWithText(replacerText);

			onReplacedWithSearchParams();
		} else {
			node.replaceWithText('searchParams');
			onReplacedWithSearchParams();
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

		onReplacedWithPathname();
	} else if (nodeName === 'isReady') {
		onReplacedWithSearchParams();
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

			parentNode.replaceWithText(`pathname?.${rightNode}`);
		} else {
			node.replaceWithText('pathname');
		}

		onReplacedWithPathname();
	} else if (nodeName === 'href') {
		node.replaceWithText('pathname');

		onReplacedWithPathname();
	} else if (nodeName === 'isFallback') {
		node.replaceWithText('false');
	} else if (nodeName === 'replace' || nodeName === 'push') {
		usesRouter.set(() => true);

		const parentNode = node.getParent();
		if (Node.isCallExpression(parentNode)) {
			handlePushCallExpression(parentNode);
		}
	} else {
		// unrecognized node names
		usesRouter.set(() => true);
	}
};

const handleQueryIdentifierNode = (
	node: Identifier,
	requiresSearchParams: Container<boolean>,
	labelContainer: Container<ReadonlyArray<string>>,
) => {
	const parent = node.getParent();

	if (Node.isPropertyAccessExpression(parent)) {
		const name = parent.getName();

		parent.replaceWithText(`searchParams?.get('${name}')`);

		requiresSearchParams.set(() => true);
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

			labelContainer.set(() => labels);
			requiresSearchParams.set(() => true);
		}
	} else if (Node.isCallExpression(parent)) {
		node.replaceWithText('searchParams');

		requiresSearchParams.set(() => true);
	} else if (Node.isElementAccessExpression(parent)) {
		const expression = parent.getArgumentExpression();

		if (Node.isStringLiteral(expression)) {
			parent.replaceWithText(
				`searchParams?.get(${expression.getText()})`,
			);

			requiresSearchParams.set(() => true);
		}
	}
};

const handleVariableDeclarationWithRouter = (
	variableDeclaration: VariableDeclaration,
	requiresPathname: Container<Set<string>>,
	requiresSearchParams: Container<boolean>,
	usesRouter: Container<boolean>,
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
					requiresPathname.set((set) => set.add(nameNode.getText()));

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
										`searchParams?.get("${nameNode.getText()}")`,
									);
								}
							} else if (Node.isArrayLiteralExpression(parent)) {
								referenceNode.replaceWithText('searchParams');
							}
						});

					requiresSearchParams.set(() => true);
					++count;
				}
			}
		}

		if (count === elements.length) {
			variableDeclaration.remove();
			return;
		}
	}

	usesRouter.set(() => true);
};

const handleVariableDeclaration = (
	variableDeclaration: VariableDeclaration,
	requiresSearchParams: Container<boolean>,
	usesRouter: Container<boolean>,
	requiresPathname: Container<Set<string>>,
	labelContainer: Container<ReadonlyArray<string>>,
) => {
	const bindingName = variableDeclaration.getNameNode();

	if (Node.isIdentifier(bindingName)) {
		bindingName.findReferencesAsNodes().forEach((node) => {
			const parent = node.getParent();

			if (Node.isPropertyAccessExpression(parent)) {
				handleRouterPropertyAccessExpression(
					parent,
					() => requiresSearchParams.set(() => true),
					usesRouter,
					() =>
						requiresPathname.set((array) => array.add('pathname')),
				);
			} else if (Node.isVariableDeclaration(parent)) {
				handleVariableDeclarationWithRouter(
					parent,
					requiresPathname,
					requiresSearchParams,
					usesRouter,
				);
			} else if (Node.isArrayLiteralExpression(parent)) {
				usesRouter.set(() => true);
			} else if (Node.isShorthandPropertyAssignment(parent)) {
				usesRouter.set(() => true);
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
								requiresSearchParams,
								labelContainer,
							);
						}
					});

					++count;
				} else if (text === 'locale') {
					++count;
				} else if (text === 'pathname' || text === 'route') {
					requiresPathname.set((set) => set.add(text));

					++count;
				} else if (text === 'isReady') {
					requiresSearchParams.set(() => true);

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
								`pathname?.${rightNode}`,
							);
						} else {
							node.replaceWithText('pathname');
						}
					});

					requiresPathname.set((set) => set.add('pathname'));
				} else if (text === 'push' || text === 'replace') {
					nameNode.findReferencesAsNodes().forEach((node) => {
						const parent = node.getParent();

						if (Node.isCallExpression(parent)) {
							handlePushCallExpression(parent);
						}
					});

					usesRouter.set(() => true);
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

				labelContainer.set(() => labels);
				requiresSearchParams.set(() => true);
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
	node: CallExpression,
	requiresSearchParams: Container<boolean>,
	usesRouter: Container<boolean>,
	requiresPathname: Container<Set<string>>,
	labelContainer: Container<ReadonlyArray<string>>,
) => {
	const parent = node.getParent();

	if (Node.isVariableDeclaration(parent)) {
		handleVariableDeclaration(
			parent,
			requiresSearchParams,
			usesRouter,
			requiresPathname,
			labelContainer,
		);
	} else if (Node.isPropertyAccessExpression(parent)) {
		const nameNode = parent.getNameNode();
		const grandparent = parent.getParent();

		if (!Node.isIdentifier(nameNode)) {
			return;
		}

		const text = nameNode.getText();

		if (text === 'isReady') {
			requiresSearchParams.set(() => true);
			parent.replaceWithText('searchParams !== null');
		} else if (text === 'pathname') {
			requiresPathname.set((set) => set.add('pathname'));

			const grandparent = parent.getParent();

			if (Node.isVariableDeclaration(grandparent)) {
				grandparent.remove();
			}
		} else if (text === 'query') {
			requiresSearchParams.set(() => true);

			if (Node.isCallExpression(grandparent)) {
				parent.replaceWithText(
					`...Object.fromEntries(searchParams ?? new URLSearchParams())`,
				);

				requiresSearchParams.set(() => true);
			} else if (Node.isElementAccessExpression(grandparent)) {
				const argumentExpression = grandparent.getArgumentExpression();

				grandparent.replaceWithText(
					`searchParams?.get(${argumentExpression?.print()})`,
				);

				requiresSearchParams.set(() => true);

				return;
			} else if (Node.isPropertyAccessExpression(grandparent)) {
				const nameNode = grandparent.getNameNode();

				if (Node.isIdentifier(nameNode)) {
					grandparent.replaceWithText(
						`searchParams?.get("${nameNode.getText()}")`,
					);
				}

				requiresSearchParams.set(() => true);
				return;
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

						requiresSearchParams.set(() => true);

						const text = properties
							.map(({ name, propertyName }) => {
								return `${name} = searchParams?.get("${propertyName}")`;
							})
							.join(',\n');

						greatgrandparent.replaceWithText(text);
					}
				}
			} else {
				parent.replaceWithText('searchParams');
			}

			return;
		} else if (text === 'isFallback') {
			parent.replaceWithText('false');
		} else if (text === 'asPath') {
			if (Node.isVariableDeclaration(grandparent)) {
				const vdName = grandparent.getName();

				grandparent.findReferencesAsNodes().forEach((reference) => {
					if (Node.isIdentifier(reference)) {
						const parentNode = reference.getParent();

						if (Node.isPropertyAccessExpression(parentNode)) {
							const parentNodeName = parentNode.getName();

							parentNode.replaceWithText(
								`${vdName}?.${parentNodeName}`,
							);
						}
					}
				});

				grandparent.remove();

				requiresPathname.set((set) => set.add(vdName));
			}
		}
	}
};

const handleUseRouterIdentifier = (
	node: Identifier,
	fileLevelUsageManager: FileLevelUsageManager,
) => {
	const block = node.getFirstAncestorByKind(ts.SyntaxKind.Block);

	if (block === undefined) {
		return;
	}

	const requiresSearchParams = buildContainer<boolean>(false);
	const usesRouter = buildContainer<boolean>(false);
	const requiresPathname = buildContainer<Set<string>>(new Set());
	const labelContainer = buildContainer<ReadonlyArray<string>>([]);

	const parent = node.getParent();

	if (Node.isCallExpression(parent)) {
		handleUseRouterCallExpression(
			parent,
			requiresSearchParams,
			usesRouter,
			requiresPathname,
			labelContainer,
		);
	}

	const statements: string[] = [];

	if (usesRouter.get()) {
		fileLevelUsageManager.reportRouterUsed();
	}

	if (requiresSearchParams.get()) {
		statements.push('const searchParams = useSearchParams();');

		fileLevelUsageManager.reportSearchParamsUsed();
	}

	{
		const pathnames = requiresPathname.get();

		for (const pathname of pathnames) {
			statements.push(`const ${pathname} = usePathname();`);

			fileLevelUsageManager.reportPathnameUsed();
		}
	}

	{
		const labels = labelContainer.get();

		for (const label of labels) {
			statements.push(`const ${label} = searchParams?.get("${label}")`);
		}
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
	importDeclaration: ImportDeclaration,
	fileLevelUsageManager: FileLevelUsageManager,
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

					handleUseRouterIdentifier(node, fileLevelUsageManager);
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
		handleImportDeclaration(importDeclaration, fileLevelUsageManager),
	);

	const namedImports = [
		fileLevelUsageManager.shouldImportUseRouter() ? 'useRouter' : null,
		fileLevelUsageManager.shouldImportUseSearchParams()
			? 'useSearchParams'
			: null,
		fileLevelUsageManager.shouldImportUsePathname() ? 'usePathname' : null,
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
