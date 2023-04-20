import {
	CallExpression,
	EmitHint,
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
	importDeclarations: ImportDeclaration[],
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

const handlePAE = (
	node: PropertyAccessExpression,
	onReplacedWithSearchParams: () => void,
	onReplacedWithPathname: () => void,
) => {
	// e.g. router.query

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
	}

	if (nodeName === 'pathname') {
		const parentNode = node.getParent();

		if (Node.isVariableDeclaration(parentNode)) {
			parentNode.remove();
		}

		onReplacedWithPathname();
	}

	if (nodeName === 'isReady') {
		node.replaceWithText('true');
	}
};

const handleQueryNode = (
	node: Node,
	requiresSearchParams: Container<boolean>,
	labelContainer: Container<ReadonlyArray<string>>,
) => {
	if (!Node.isIdentifier(node)) {
		return;
	}

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
	requiresPathname: Container<string | null>,
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
				requiresPathname.set(() => nameNode.getText());

				++count;
			}
		}

		if (count === elements.length) {
			variableDeclaration.remove();
		}
	}
};

const handleUseRouterCallExpression = (
	node: CallExpression,
	requiresSearchParams: Container<boolean>,
	requiresPathname: Container<string | null>,
	labelContainer: Container<ReadonlyArray<string>>,
) => {
	const parent = node.getParent();

	if (Node.isVariableDeclaration(parent)) {
		const bindingName = parent.getNameNode();

		if (Node.isIdentifier(bindingName)) {
			bindingName.findReferencesAsNodes().forEach((node) => {
				const parent = node.getParent();

				if (Node.isPropertyAccessExpression(parent)) {
					handlePAE(
						parent,
						() => requiresSearchParams.set(() => true),
						() => requiresPathname.set(() => 'pathname'),
					);

					return;
				}

				if (Node.isVariableDeclaration(parent)) {
					handleVariableDeclarationWithRouter(
						parent,
						requiresPathname,
					);
				}
			});

			const referenceCount = bindingName.findReferencesAsNodes().length;

			if (referenceCount === 0) {
				parent.remove();
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
							handleQueryNode(
								node,
								requiresSearchParams,
								labelContainer,
							);
						});

						++count;
					}

					if (text === 'pathname') {
						requiresPathname.set(() => 'pathname');

						++count;
					}

					if (text === 'isReady') {
						nameNode.findReferencesAsNodes().forEach((node) => {
							node.replaceWithText('true');
						});

						++count;
					}

					if (text === 'route') {
						++count;
					}
				}
			}

			if (elements.length === count) {
				parent.remove();
				return;
			}
		}

		return;
	}

	if (Node.isPropertyAccessExpression(parent)) {
		const nameNode = parent.getNameNode();

		if (Node.isIdentifier(nameNode) && nameNode.getText() === 'isReady') {
			parent.replaceWithText('true');

			return;
		}

		if (Node.isIdentifier(nameNode) && nameNode.getText() === 'pathname') {
			requiresPathname.set(() => 'pathname');

			const grandparent = parent.getParent();

			if (Node.isVariableDeclaration(grandparent)) {
				grandparent.remove();
			}

			return;
		}

		const grandparent = parent.getParent();

		if (Node.isPropertyAccessExpression(grandparent)) {
			const nameNode = grandparent.getNameNode();

			if (Node.isIdentifier(nameNode)) {
				grandparent.replaceWithText(
					`searchParams.get("${nameNode.getText()}")`,
				);
			}
		}

		requiresSearchParams.set(() => true);
	}
};

const handleUseRouterNode = (
	node: Node<ts.Node>,
	usesSearchParams: Container<boolean>,
	usesPathname: Container<boolean>,
) => {
	if (!Node.isIdentifier(node)) {
		return;
	}

	const block = node.getFirstAncestorByKind(ts.SyntaxKind.Block);

	if (block === undefined) {
		return;
	}

	const requiresSearchParams = buildContainer<boolean>(false); // TODO check if the statement exists
	const requiresPathname = buildContainer<string | null>(null); // TODO check if the statement exists
	const labelContainer = buildContainer<ReadonlyArray<string>>([]);

	const parent = node.getParent();

	if (Node.isCallExpression(parent)) {
		handleUseRouterCallExpression(
			parent,
			requiresSearchParams,
			requiresPathname,
			labelContainer,
		);
	}

	const statements: string[] = [];

	if (requiresSearchParams.get()) {
		statements.push('const searchParams = useSearchParams();');

		usesSearchParams.set(() => true);
	}

	{
		const pathname = requiresPathname.get();

		if (pathname !== null) {
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
			.forEach((node) =>
				handleUseRouterNode(node, usesSearchParams, usesPathname),
			);

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

	// TODO can we remove it?
	importDeclaration.remove();
};

export const handleSourceFile = (
	sourceFile: SourceFile,
): string | undefined => {
	const usesSearchParams = buildContainer<boolean>(false);
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
			usesSearchParams,
			usesPathname,
		),
	);

	if (useRouterReferenceCount.get() === 0) {
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
