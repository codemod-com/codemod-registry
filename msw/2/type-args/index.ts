import {
	SyntaxKind,
	type CallExpression,
	type SourceFile,
	type Block,
	type ParameterDeclaration,
	type ArrowFunction,
	type FunctionExpression,
} from 'ts-morph';

function getImportDeclarationAlias(
	sourceFile: SourceFile,
	moduleSpecifier: string,
	name: string,
) {
	const importDeclaration = sourceFile.getImportDeclaration(moduleSpecifier);
	if (!importDeclaration) {
		return null;
	}

	const namedImport = importDeclaration
		.getNamedImports()
		.find((specifier) => specifier.getName() === name);

	if (!namedImport) {
		return null;
	}

	return namedImport.getAliasNode()?.getText() || namedImport.getName();
}

function isMSWCall(sourceFile: SourceFile, callExpr: CallExpression) {
	const httpCallerName = getImportDeclarationAlias(sourceFile, 'msw', 'http');
	const graphqlCallerName = getImportDeclarationAlias(
		sourceFile,
		'msw',
		'graphql',
	);

	const identifiers =
		callExpr
			.getChildrenOfKind(SyntaxKind.PropertyAccessExpression)
			.at(0)
			?.getChildrenOfKind(SyntaxKind.Identifier) ?? [];

	const caller = identifiers.at(0);

	if (!caller) {
		return false;
	}

	const method = identifiers.at(1) ?? caller;

	const methodText = method.getText();

	const isHttpCall =
		caller.getText() === httpCallerName &&
		// This is what would be cool to get through inferring the type via
		// typeChecker/langServer/diagnostics etc, for example
		[
			'all',
			'get',
			'post',
			'put',
			'patch',
			'delete',
			'head',
			'options',
		].includes(methodText);

	const isGraphQLCall =
		caller.getText() === graphqlCallerName &&
		['query', 'mutation'].includes(methodText);

	return isHttpCall || isGraphQLCall;
}

function getCallbackData(
	expression: CallExpression,
):
	| [
			Block,
			ReadonlyArray<ParameterDeclaration>,
			FunctionExpression | ArrowFunction,
	  ]
	| null {
	const mockCallback = expression.getArguments().at(1) ?? null;

	if (mockCallback === null) {
		return null;
	}

	const cbParams = mockCallback.getChildrenOfKind(SyntaxKind.Parameter);

	const callbackBody =
		mockCallback.getChildrenOfKind(SyntaxKind.Block).at(0) ??
		(mockCallback as Block);

	const syntaxCb =
		mockCallback.asKind(SyntaxKind.ArrowFunction) ??
		mockCallback.asKind(SyntaxKind.FunctionExpression) ??
		null;

	if (syntaxCb === null) {
		return null;
	}

	return [callbackBody, cbParams, syntaxCb];
}

function shouldProcessFile(sourceFile: SourceFile): boolean {
	return (
		sourceFile
			.getImportDeclarations()
			.find((decl) =>
				decl.getModuleSpecifier().getLiteralText().startsWith('msw'),
			) !== undefined
	);
}

export function handleSourceFile(sourceFile: SourceFile): string | undefined {
	if (!shouldProcessFile(sourceFile)) {
		return undefined;
	}

	const toInsertManually = {} as Record<number, string>;

	sourceFile
		.getDescendantsOfKind(SyntaxKind.CallExpression)
		.filter((callExpr) => isMSWCall(sourceFile, callExpr))
		.forEach((expression) => {
			const genericTypeArgs = expression.getTypeArguments();

			if (genericTypeArgs.length) {
				const newArgs = [
					// unknown does not work:
					// Type 'unknown' does not satisfy the constraint 'PathParams<never>'.
					genericTypeArgs.at(1)?.getText() || 'any',
					genericTypeArgs.at(0)!.getText(),
					genericTypeArgs.at(2)?.getText(),
				].filter(Boolean) as string[];

				expression.insertTypeArguments(0, newArgs);
				genericTypeArgs.forEach((arg) =>
					expression.removeTypeArgument(arg),
				);
			}

			const callbackData = getCallbackData(expression);
			if (callbackData === null) {
				return;
			}
			const [callbackBody] = callbackData;

			const bodyCasts = callbackBody
				.getDescendantsOfKind(SyntaxKind.AsExpression)
				.filter((asExpr) =>
					asExpr
						.getDescendantsOfKind(SyntaxKind.Identifier)
						.find((id) => id.getText() === 'body'),
				);

			if (bodyCasts.length) {
				bodyCasts.forEach((asExpr) => {
					const castedProperty =
						asExpr.getFirstChild()?.getText() ?? null;
					const castedToType =
						asExpr
							.getChildrenOfKind(SyntaxKind.TypeReference)
							.at(0)
							?.getText() ?? null;

					if (castedProperty === null || castedToType === null) {
						return;
					}

					asExpr.replaceWithText(castedProperty);

					const existingBodyType =
						expression.getTypeArguments().at(1) ?? null;

					if (existingBodyType !== null) {
						existingBodyType.replaceWithText(castedToType);
					} else {
						const callerEndPos =
							expression.getFirstChild()?.getEnd() ?? null;

						if (callerEndPos === null) {
							return;
						}

						// Has to be done like that, because addTypeArguments throws if no <> (generic braces) are there,
						// and insertText forgets all the previously navigated nodes, so it breaks the forEach loop.
						// Uncomment below and read the function jsdoc:
						// sourceFile.insertText(callerEndPos, `<any, ${castedToType}>`);

						// using new Map would be nicer, but it's harder to iterate over, so whatever
						toInsertManually[
							callerEndPos
						] = `<any, ${castedToType}>`;
					}
				});
			}
		});

	let offset = 0;
	Object.entries(toInsertManually)
		.sort(([pos1], [pos2]) => +pos1 - +pos2)
		.forEach(([pos, value]) => {
			sourceFile.insertText(+pos + offset, value);
			offset += value.length;
		});

	return sourceFile.getFullText();
}
