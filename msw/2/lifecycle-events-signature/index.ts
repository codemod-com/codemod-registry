import { type SourceFile, SyntaxKind } from 'ts-morph';

// The issue with that approach in this particular codemod is that caller of the .on method
// should be imported from MSW. I believe there is a way to check if the caller is from 3rd party lib
// by going up the import path, but that would require more efforts.
// This codemod is BETA.
function shouldProcessFile(sourceFile: SourceFile) {
	return !!sourceFile
		.getImportDeclarations()
		.find((decl) =>
			decl.getModuleSpecifier().getLiteralText().startsWith('msw'),
		);
}

// https://mswjs.io/docs/migrations/1.x-to-2.x/#life-cycle-events
export function handleSourceFile(sourceFile: SourceFile): string | undefined {
	if (!shouldProcessFile(sourceFile)) {
		return undefined;
	}

	sourceFile
		.getDescendantsOfKind(SyntaxKind.CallExpression)
		.filter(
			(ce) =>
				ce
					.getChildrenOfKind(SyntaxKind.PropertyAccessExpression)[0]
					?.getText()
					.endsWith('.on'),
		)
		.forEach((eventHandler) => {
			const cbNode = eventHandler.getArguments()[1];
			if (!cbNode) {
				return;
			}
			const callback = cbNode.asKindOrThrow(
				cbNode.getKind() as
					| SyntaxKind.ArrowFunction
					| SyntaxKind.FunctionExpression,
			);
			const [requestParam, requestIdParam] = callback.getChildrenOfKind(
				SyntaxKind.Parameter,
			);

			if (requestParam) {
				requestParam.rename('request');
				requestParam.remove();
			}

			if (requestIdParam) {
				requestIdParam.rename('requestId');
				requestIdParam.remove();
			}

			callback.addParameter({
				name: '{ request, requestId }',
			});
		});

	return sourceFile.getFullText();
}
