import {
	BindingElement,
	Block,
	ObjectBindingPattern,
	Project,
	SyntaxKind,
	VariableDeclaration,
	VariableDeclarationKind,
} from 'ts-morph';
import { factory } from 'typescript';

export default function transformer(
	sourceFileText: string,
): string | undefined {
	const project = new Project();

	const sourceFile = project.createSourceFile('index.ts', sourceFileText);

	/** IMPORTS **/
	{
		let hasUseRouterImportSpecifier = false;

		sourceFile.getImportDeclarations().forEach((importDeclaration) => {
			importDeclaration.getNamedImports().forEach((importSpecifier) => {
				if (importSpecifier.getName() === 'useRouter') {
					hasUseRouterImportSpecifier = true;
				}
			});
		});

		if (!hasUseRouterImportSpecifier) {
			return undefined;
		}

		sourceFile.addImportDeclaration({
			moduleSpecifier: 'next/navigation',
			namedImports: [
				{
					name: 'useSearchParams',
				},
			],
		});
	}

	/** useRouter usages */
	{
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
									objectBindingPatterns.add(
										objectBindingPattern,
									);

									variableDeclarations.add(
										variableDeclaration,
									);

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
			bindingElement.transform(() =>
				factory.createObjectBindingPattern([]),
			),
		);

		blocks.forEach((block) => {
			block.addVariableStatement({
				declarationKind: VariableDeclarationKind.Const,
				declarations: [
					{
						name: 'query',
						initializer: 'useSearchParams()',
					},
				],
			});
		});
	}

	/** specific nodes stemming from query */
	{
		const structures = new Set<
			[Block | undefined, BindingElement, string]
		>();

		const variableDeclarations = new Set<VariableDeclaration>();

		sourceFile
			.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
			.forEach((variableDeclaration) => {
				const initializer = variableDeclaration.getInitializerIfKind(
					SyntaxKind.Identifier,
				);

				if (!initializer || initializer.getText() !== 'query') {
					return;
				}

				variableDeclaration
					.getDescendantsOfKind(SyntaxKind.BindingElement)
					.forEach((bindingElement) => {
						const block =
							variableDeclaration.getFirstAncestorByKind(
								SyntaxKind.Block,
							);

						structures.add([
							block,
							bindingElement,
							bindingElement.getName(),
						]);

						variableDeclarations.add(variableDeclaration);
					});
			});

		structures.forEach(([block, bindingElement, name]) => {
			bindingElement.replaceWithText('');

			block?.addVariableStatement({
				declarationKind: VariableDeclarationKind.Const,
				declarations: [
					{
						name,
						initializer: 'query.get("a")',
					},
				],
			});
		});

		variableDeclarations.forEach((variableDeclaration) => {
			variableDeclaration.remove();
		});
	}

	return sourceFile.getText();
}
