import { SyntaxKind, type CallExpression, type SourceFile } from 'ts-morph';

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
		});

	return sourceFile.getFullText();
}
