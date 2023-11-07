import { SourceFile, SyntaxKind } from 'ts-morph';

function shouldProcessFile(sourceFile: SourceFile) {
	return !!sourceFile
		.getImportDeclarations()
		.find((decl) =>
			decl.getModuleSpecifier().getLiteralText().startsWith('msw'),
		);
}

// https://mswjs.io/docs/migrations/1.x-to-2.x/#printhandlers
export function handleSourceFile(sourceFile: SourceFile): string | undefined {
	if (!shouldProcessFile(sourceFile)) {
		return undefined;
	}

	sourceFile
		.getDescendantsOfKind(SyntaxKind.CallExpression)
		.map((ce) => ce.getDescendantsOfKind(SyntaxKind.Identifier))
		.flat()
		.filter((id) => id.getText() === 'printHandlers')
		.forEach((id) => {
			id.replaceWithText('listHandlers');

			const callExpressionEndPosition =
				id
					.getAncestors()
					.find(
						(parent) =>
							parent.getKind() === SyntaxKind.CallExpression,
					)
					?.getEnd() ?? null;

			if (callExpressionEndPosition === null) {
				return;
			}

			sourceFile
				.insertText(
					callExpressionEndPosition,
					`.forEach((handler) => {
              console.log(handler.info.header)
            })`,
				)
				.formatText();
		});

	return sourceFile.getFullText();
}
