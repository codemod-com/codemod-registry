import {
	CallExpression,
	EmitHint,
	Identifier,
	ImportDeclaration,
	VariableDeclaration,
} from 'ts-morph';
import { PropertyAccessExpression, SourceFile, ts } from 'ts-morph';
import { Node } from 'ts-morph';

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

			parentNode.replaceWithText(`searchParams.get("${parentNodeName}")`);

			onReplacedWithSearchParams();
			return;
		}

		if (Node.isSpreadAssignment(parentNode)) {
			parentNode.replaceWithText(`...Object.fromEntries(searchParams)`);

			onReplacedWithSearchParams();
			return;
		}

		if (Node.isVariableDeclaration(parentNode)) {
			const bindingName = parentNode.getNameNode();

			if (Node.isObjectBindingPattern(bindingName)) {
				const bindingElements = bindingName.getElements();

				const names = bindingElements.map((bindingElement) => {
					return bindingElement.getName();
				});

				const vdl = parentNode.getFirstAncestorByKind(
					ts.SyntaxKind.VariableDeclarationList,
				);

				for (const name of names) {
					vdl?.addDeclaration({
						name,
						initializer: `searchParams.get("${name}")`,
					});
				}

				parentNode.remove();

				onReplacedWithSearchParams();
				return;
			}
		}

		node.replaceWithText('searchParams');
		onReplacedWithSearchParams();

		return;
	}

	if (nodeName === 'pathname') {
		const parentNode = node.getParent();

		if (Node.isVariableDeclaration(parentNode)) {
			parentNode.remove();
		} else {
			node.replaceWithText('pathname');
		}

		onReplacedWithPathname();

		return;
	}

	if (nodeName === 'isReady') {
		node.replaceWithText('true');

		return;
	}

	if (nodeName === 'asPath') {
		node.replaceWithText('`${pathname}?${searchParams}`');

		onReplacedWithSearchParams();
		onReplacedWithPathname();

		return;
	}

	// unrecognized node names
	usesRouter.set(() => true);
};

const handleQueryIdentifierNode = (
	node: Identifier,
	requiresSearchParams: Container<boolean>,
	labelContainer: Container<ReadonlyArray<string>>,
) => {
	const parent = node.getParent();

	if (Node.isPropertyAccessExpression(parent)) {
		const name = parent.getName();

		parent.replaceWithText(`searchParams.get('${name}')`);

		requiresSearchParams.set(() => true);

		return;
	}

	if (Node.isVariableDeclaration(parent)) {
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

			return;
		}
	}
};

const handleVariableDeclarationWithRouter = (
	variableDeclaration: VariableDeclaration,
	requiresPathname: Container<Set<string>>,
) => {
	const nameNode = variableDeclaration.getNameNode();

	if (Node.isObjectBindingPattern(nameNode)) {
		const elements = nameNode.getElements();
		let count = 0;

		for (const element of elements) {
			const nameNode = element.getNameNode();
			const propertyNameNode = element.getPropertyNameNode() ?? nameNode;

			if (
				Node.isIdentifier(propertyNameNode) &&
				propertyNameNode.getText() === 'pathname'
			) {
				requiresPathname.set((set) => set.add(nameNode.getText()));

				++count;
			}
		}

		if (count === elements.length) {
			variableDeclaration.remove();
		}
	}
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

				return;
			}

			if (Node.isVariableDeclaration(parent)) {
				handleVariableDeclarationWithRouter(parent, requiresPathname);
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
				}

				if (text === 'pathname' || text === 'route') {
					requiresPathname.set((set) => set.add(text));

					++count;
				}

				if (text === 'isReady') {
					nameNode.findReferencesAsNodes().forEach((node) => {
						node.replaceWithText('true');
					});

					++count;
				}
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
		return;
	}

	if (Node.isPropertyAccessExpression(parent)) {
		const nameNode = parent.getNameNode();
		const grandparent = parent.getParent();

		if (Node.isIdentifier(nameNode) && nameNode.getText() === 'isReady') {
			parent.replaceWithText('true');

			return;
		}

		if (Node.isIdentifier(nameNode) && nameNode.getText() === 'pathname') {
			requiresPathname.set((set) => set.add('pathname'));

			const grandparent = parent.getParent();

			if (Node.isVariableDeclaration(grandparent)) {
				grandparent.remove();
			}

			return;
		}

		if (Node.isIdentifier(nameNode) && nameNode.getText() === 'query') {
			requiresSearchParams.set(() => true);

			if (Node.isCallExpression(grandparent)) {
				parent.replaceWithText(`...Object.fromEntries(searchParams)`);

				requiresSearchParams.set(() => true);
			} else if (Node.isElementAccessExpression(grandparent)) {
				const argumentExpression = grandparent.getArgumentExpression();

				grandparent.replaceWithText(
					`searchParams.get(${argumentExpression?.print()})`,
				);

				requiresSearchParams.set(() => true);

				return;
			} else if (Node.isPropertyAccessExpression(grandparent)) {
				const nameNode = grandparent.getNameNode();

				if (Node.isIdentifier(nameNode)) {
					grandparent.replaceWithText(
						`searchParams.get("${nameNode.getText()}")`,
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
								return `${name} = searchParams.get("${propertyName}")`;
							})
							.join(',\n');

						greatgrandparent.replaceWithText(text);
					}
				}
			} else {
				parent.replaceWithText('searchParams');
			}
		}
	}
};

const handleUseRouterIdentifier = (
	node: Identifier,
	usesRouterImport: Container<boolean>,
	usesSearchParams: Container<boolean>,
	usesPathname: Container<boolean>,
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
		usesRouterImport.set(() => true);
	}

	if (requiresSearchParams.get()) {
		statements.push('const searchParams = useSearchParams();');

		usesSearchParams.set(() => true);
	}

	{
		const pathnames = requiresPathname.get();

		for (const pathname of pathnames) {
			statements.push(`const ${pathname} = usePathname();`);
			usesPathname.set(() => true);
		}
	}

	{
		const labels = labelContainer.get();

		for (const label of labels) {
			statements.push(`const ${label} = searchParams.get("${label}")`);
		}
	}

	block.insertStatements(0, statements);
};

const handleImportDeclaration = (
	importDeclaration: ImportDeclaration,
	useRouterReferenceCount: Container<number>,
	usesRoute: Container<boolean>,
	usesSearchParams: Container<boolean>,
	usesPathname: Container<boolean>,
) => {
	const moduleSpecifier = importDeclaration.getModuleSpecifier();

	if (moduleSpecifier.getLiteralText() !== 'next/router') {
		return;
	}

	importDeclaration.getNamedImports().forEach((namedImport) => {
		if (namedImport.getName() !== 'useRouter') {
			return;
		}

		namedImport
			.getNameNode()
			.findReferencesAsNodes()
			.forEach((node) => {
				if (!Node.isIdentifier(node)) {
					return;
				}

				handleUseRouterIdentifier(
					node,
					usesRoute,
					usesSearchParams,
					usesPathname,
				);
			});

		const referenceCount = namedImport
			.getNameNode()
			.findReferencesAsNodes().length;

		if (referenceCount === 0) {
			namedImport.remove();
		}

		useRouterReferenceCount.set(
			(previousCount) => previousCount + referenceCount,
		);
	});

	importDeclaration.remove();
};

export const handleSourceFile = (
	sourceFile: SourceFile,
): string | undefined => {
	const usesSearchParams = buildContainer<boolean>(false);
	const usesRouter = buildContainer<boolean>(false);
	const usesPathname = buildContainer<boolean>(false);

	const importDeclarations = sourceFile.getImportDeclarations();

	const hasUseRouterImport = hasImport(
		importDeclarations,
		'next/router',
		'useRouter',
	);

	if (!hasUseRouterImport) {
		return undefined;
	}

	const hasUseSearchParamsImport = hasImport(
		importDeclarations,
		'next/navigation',
		'useSearchParams',
	);

	const hasUsePathnameImport = hasImport(
		importDeclarations,
		'next/navigation',
		'usePathname',
	);

	const useRouterReferenceCount = buildContainer<number>(0);

	importDeclarations.forEach((importDeclaration) =>
		handleImportDeclaration(
			importDeclaration,
			useRouterReferenceCount,
			usesRouter,
			usesSearchParams,
			usesPathname,
		),
	);

	if (useRouterReferenceCount.get() === 0 || usesRouter.get()) {
		sourceFile.insertStatements(
			0,
			'import { useRouter } from "next/navigation";',
		);
	}

	if (usesSearchParams.get() && !hasUseSearchParamsImport) {
		sourceFile.insertStatements(
			0,
			'import { useSearchParams } from "next/navigation";',
		);
	}

	if (usesPathname.get() && !hasUsePathnameImport) {
		sourceFile.insertStatements(
			0,
			'import { usePathname } from "next/navigation";',
		);
	}

	return sourceFile.print({ emitHint: EmitHint.SourceFile });
};
