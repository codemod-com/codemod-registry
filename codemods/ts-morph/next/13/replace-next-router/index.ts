import { CallExpression, EmitHint, ImportDeclaration } from 'ts-morph';
import { PropertyAccessExpression, SourceFile, ts } from 'ts-morph';
import { Node } from 'ts-morph';

export const buildContainer = <T>(initialValue: NonNullable<T>) => {
	let currentValue: NonNullable<T> = initialValue;

	const get = (): NonNullable<T> => {
		return currentValue;
	};

	const set = (
		callback: (previousValue: NonNullable<T>) => NonNullable<T>,
	): void => {
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
		node.replaceWithText('pathname');
		onReplacedWithPathname();
	}
};

const handleQueryNode = (
	node: Node,
	requiresSearchParams: Container<boolean>,
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
		console.log(parent.print());

		// TODO expand here
	}
};

const handleUseRouterCallExpression = (
	node: CallExpression,
	requiresSearchParams: Container<boolean>,
	requiresPathname: Container<boolean>,
) => {
	const parent = node.getParent();

	if (Node.isVariableDeclaration(parent)) {
		const bindingName = parent.getNameNode();

		if (Node.isIdentifier(bindingName)) {
			// e.g. router

			bindingName.findReferencesAsNodes().forEach((node) => {
				const parent = node.getParent();

				if (Node.isPropertyAccessExpression(parent)) {
					handlePAE(
						parent,
						() => requiresSearchParams.set(() => true),
						() => requiresPathname.set(() => true),
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
					if (nameNode.getText() === 'query') {
						console.log('ABCD', parent.print());

						// find query.a usages

						// TODO

						nameNode.findReferencesAsNodes().forEach((node) => {
							handleQueryNode(node, requiresSearchParams);
						});
					}

					// TODO ensure we remove it when all occurences have been replaced
					// parent.remove();
					++count;
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

const handleReferencedNode = (
	node: Node<ts.Node>,
	usesSearchParams: Container<boolean>,
	usesPathname: Container<boolean>,
) => {
	if (Node.isIdentifier(node)) {
		const block = node.getFirstAncestorByKind(ts.SyntaxKind.Block);

		const requiresSearchParams = buildContainer<boolean>(false); // TODO check if the statement exists
		const requiresPathname = buildContainer<boolean>(false); // TODO check if the statement exists

		const parent = node.getParent();

		if (Node.isCallExpression(parent)) {
			handleUseRouterCallExpression(
				parent,
				requiresSearchParams,
				requiresPathname,
			);
		}

		if (requiresSearchParams.get()) {
			block?.insertStatements(
				0,
				'const searchParams = useSearchParams();',
			);

			usesSearchParams.set(() => true);
		}

		if (requiresPathname.get()) {
			block?.insertStatements(0, 'const pathname = usePathname();');

			usesPathname.set(() => true);
		}
	}
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
				handleReferencedNode(node, usesSearchParams, usesPathname),
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
