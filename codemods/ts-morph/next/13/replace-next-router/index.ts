import {
	CallExpression,
	EmitHint,
	Identifier,
	ImportDeclaration,
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
						initializer: `searchParams?.get("${name}")`,
					});
				}

				parentNode.remove();

				onReplacedWithSearchParams();
			}
		} else if (Node.isCallExpression(parentNode)) {
			node.replaceWithText(
				'...Object.fromEntries(searchParams ?? new URLSearchParams())',
			);
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
		node.replaceWithText('true');
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
		const parentNode = node.getParent();
		if (Node.isCallExpression(parentNode)) {
			const arg = parentNode.getArguments()[0];
			if (Node.isStringLiteral(arg)) {
				return;
			}
			if (Node.isObjectLiteralExpression(arg)) {
				const pathnameNode = arg.getProperty('pathname');
				const queryNode = arg.getProperty('query');

				if (Node.isPropertyAssignment(pathnameNode)) {
					const pathNameValue =
						pathnameNode.getInitializer()?.getText() ?? '';
					if (!Node.isPropertyAssignment(queryNode)) {
						parentNode.replaceWithText(
							`router.${nodeName}(${pathNameValue})`,
						);
						return;
					}

					const queryValue =
						queryNode.getInitializer()?.getText() ?? '{}';

					parentNode.replaceWithText(
						`const urlSearchParams = new URLSearchParams(${queryValue});\n
							router.${nodeName}(\`${pathNameValue.replace(
							/"/g,
							'',
						)}?\${urlSearchParams.toString()}\`);`,
					);
				}
			}
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
			} else if (Node.isVariableDeclaration(parent)) {
				handleVariableDeclarationWithRouter(parent, requiresPathname);
			} else if (Node.isArrayLiteralExpression(parent)) {
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
					nameNode.findReferencesAsNodes().forEach((node) => {
						node.replaceWithText('true');
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
	} else if (Node.isPropertyAccessExpression(parent)) {
		const nameNode = parent.getNameNode();
		const grandparent = parent.getParent();

		if (!Node.isIdentifier(nameNode)) {
			return;
		}

		const text = nameNode.getText();

		if (text === 'isReady') {
			parent.replaceWithText('true');
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
			statements.push(`const ${label} = searchParams?.get("${label}")`);
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
