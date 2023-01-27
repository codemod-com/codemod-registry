import {
	BindingElement,
	Block,
	ImportDeclaration,
	ImportSpecifier,
	ObjectBindingPattern,
	Project,
	SyntaxKind,
	VariableDeclaration,
} from 'ts-morph';
import { factory } from 'typescript';

export default function transformer(sourceFileText: string): string {
	const project = new Project();

	const sourceFile = project.createSourceFile('index.ts', sourceFileText);

	/** IMPORTS **/
	const importStructures = new Set<[ImportDeclaration, ImportSpecifier]>();

	sourceFile.getImportDeclarations().forEach((importDeclaration) => {
		importDeclaration.getNamedImports().forEach((importSpecifier) => {
			if (importSpecifier.getName() === 'useRouter') {
				importStructures.add([importDeclaration, importSpecifier]);
			}
		});
	});

	importStructures.forEach(([importDeclaration, importSpecifier]) => {
		if (importDeclaration.getNamedImports().length === 1) {
			importDeclaration.remove();
		} else {
			importSpecifier.remove();
		}
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: 'next/navigation',
		namedImports: [
			{
				name: 'useSearchParams',
			},
		],
	});

	const blocks = new Set<Block>();
	const variableDeclarations = new Set<VariableDeclaration>();
	const objectBindingPatterns = new Set<ObjectBindingPattern>();

	sourceFile
		.getDescendantsOfKind(SyntaxKind.CallExpression)
		.forEach((callExpression) => {
			const expression = callExpression.getExpression();

			if (!expression.isKind(SyntaxKind.Identifier)) {
				return;
			}

			if (expression.getText() !== 'useRouter') {
				return;
			}

			const variableDeclaration = callExpression.getParentIfKind(
				SyntaxKind.VariableDeclaration,
			);

			if (!variableDeclaration) {
				return;
			}

			variableDeclaration
				.getDescendantsOfKind(SyntaxKind.ObjectBindingPattern)
				.forEach((objectBindingPattern) => {
					objectBindingPattern
						.getElements()
						.forEach((bindingElement) => {
							if (bindingElement.getName() === 'query') {
								objectBindingPatterns.add(objectBindingPattern);

								variableDeclarations.add(variableDeclaration);

								const block =
									variableDeclaration.getFirstAncestorByKind(
										SyntaxKind.Block,
									);

								if (block) {
									blocks.add(block);
								}
							}
						});
				});
		});

	// removal

	objectBindingPatterns.forEach((bindingElement) =>
		bindingElement.transform(() => factory.createObjectBindingPattern([])),
	);

	variableDeclarations.forEach((variableDeclaration) => {
		if (
			variableDeclaration.getDescendantsOfKind(SyntaxKind.BindingElement)
				.length === 0
		) {
			variableDeclaration.remove();
		}
	});

	// add

	blocks.forEach((block) => {
		block.addVariableStatement({
			// TODO const vs let
			declarations: [
				{
					name: 'query',
					initializer: 'useSearchParams()',
				},
			],
		});
	});

	return sourceFile.getText();
}
