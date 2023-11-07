import {
	ParameterDeclaration,
	SyntaxKind,
	type ArrowFunction,
	type Block,
	type CallExpression,
	type FunctionExpression,
	type SourceFile,
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

	const identifiers = callExpr
		.getChildrenOfKind(SyntaxKind.PropertyAccessExpression)[0]
		?.getChildrenOfKind(SyntaxKind.Identifier);

	const caller = identifiers?.[0];
	let method = identifiers?.[1];

	if (!caller) {
		return false;
	}

	if (!method) {
		method = caller;
	}

	const isHttpCall =
		caller?.getText() === httpCallerName &&
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
		].includes(method.getText());

	const isGraphQLCall =
		caller?.getText() === graphqlCallerName &&
		['query', 'mutation'].includes(method.getText());

	return isHttpCall || isGraphQLCall;
}

function getCallbackData(
	expression: CallExpression,
): [Block, ParameterDeclaration[], FunctionExpression | ArrowFunction] | null {
	const mockCallback = expression.getArguments()[1];

	if (!mockCallback) {
		return null;
	}

	const cbParams = mockCallback.getChildrenOfKind(SyntaxKind.Parameter);

	let callbackBody = mockCallback.getChildrenOfKind(SyntaxKind.Block)[0];
	if (!callbackBody) {
		callbackBody = mockCallback as Block;
	}

	const syntaxCb = mockCallback.asKindOrThrow(
		mockCallback.getKind() as
			| SyntaxKind.ArrowFunction
			| SyntaxKind.FunctionExpression,
	);

	return [callbackBody, cbParams, syntaxCb];
}

function shouldProcessFile(sourceFile: SourceFile) {
	return !!sourceFile
		.getImportDeclarations()
		.find((decl) =>
			decl.getModuleSpecifier().getLiteralText().startsWith('msw'),
		);
}

// https://mswjs.io/docs/migrations/1.x-to-2.x/#request-changes
export function handleSourceFile(sourceFile: SourceFile): string | undefined {
	if (!shouldProcessFile(sourceFile)) {
		return undefined;
	}

	sourceFile
		.getDescendantsOfKind(SyntaxKind.CallExpression)
		.filter((callExpr) => isMSWCall(sourceFile, callExpr))
		.forEach((expression) => {
			const callbackData = getCallbackData(expression);
			if (!callbackData) return;
			const [, callParams, syntaxCb] = callbackData;
			const [reqParam] = callParams;

			const references = reqParam?.findReferencesAsNodes();
			if (references?.length) {
				references.forEach((ref) => {
					ref.replaceWithText('request');
				});
			}

			callParams.forEach((param) => {
				param.remove();
			});

			syntaxCb.addParameter({
				name: `{ request, params, cookies }`,
			});
		});

	sourceFile.fixUnusedIdentifiers();

	return sourceFile.getFullText();
}
