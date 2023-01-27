import { ImportSpecifier, Project, SyntaxKind } from 'ts-morph';

export default function transformer(sourceFileText: string): string {
	const project = new Project();

	const sourceFile = project.createSourceFile('index.ts', sourceFileText);

	const importSpecifiers: ImportSpecifier[] = [];

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

			if (
				expression.isKind(SyntaxKind.Identifier) &&
				expression.getText() === 'useRouter'
			) {
				console.log('HERE');

				const variableDeclaration = callExpression.getParentIfKind(
					SyntaxKind.VariableDeclaration,
				);

				if 
			}
		});

	// removal

	importSpecifiers.forEach((importSpecifier) => importSpecifier.remove());

	return sourceFile.getText();
}
