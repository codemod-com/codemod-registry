import {
	BindingElement,
	ImportSpecifier,
	ObjectBindingPattern,
	Project,
	SyntaxKind,
} from 'ts-morph';
import { factory } from 'typescript';

export default function transformer(sourceFileText: string): string {
	const project = new Project();

	const sourceFile = project.createSourceFile('index.ts', sourceFileText);

	const importSpecifiers: ImportSpecifier[] = [];
	const objectBindingPatterns = new Set<ObjectBindingPattern>();

	sourceFile.getImportDeclarations().forEach((declaration) => {
		declaration
			.getImportClause()
			?.getNamedImports()
			.forEach((importSpecifier) => {
				if (importSpecifier.getName() === 'useRouter') {
					importSpecifiers.push(importSpecifier);
				}
			});
	});

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
							}
						});
				});
		});

	// removal
	importSpecifiers.forEach((importSpecifier) => importSpecifier.remove());
	objectBindingPatterns.forEach((bindingElement) =>
		bindingElement.transform(() => factory.createObjectBindingPattern([])),
	);

	return sourceFile.getText();
}
