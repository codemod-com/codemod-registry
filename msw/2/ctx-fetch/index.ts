import {
	ParameterDeclaration,
	SourceFile,
	SyntaxKind,
	type ArrowFunction,
	type BindingElement,
	type Block,
	type CallExpression,
	type FunctionExpression,
	type ImportDeclaration,
	type ImportSpecifier,
} from 'ts-morph';

function addNamedImportDeclaration(
	sourceFile: SourceFile,
	moduleSpecifier: string,
	name: string,
): ImportDeclaration | ImportSpecifier {
	const importDeclaration =
		sourceFile.getImportDeclaration(moduleSpecifier) ??
		sourceFile.addImportDeclaration({ moduleSpecifier });

	if (
		importDeclaration
			.getNamedImports()
			.some((specifier) => specifier.getName() === name)
	) {
		return importDeclaration;
	}

	return importDeclaration.addNamedImport({ name });
}

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

function searchIdentifiers(
	codeBlock: Block,
	searchables: ReadonlyArray<string>,
): ReadonlySet<string> {
	const matchedStrings = [
		...codeBlock.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression),
		...codeBlock.getDescendantsOfKind(SyntaxKind.BindingElement),
	].flatMap((parent) => {
		const identifiers = parent.getDescendantsOfKind(SyntaxKind.Identifier);

		return searchables.filter((tested) =>
			identifiers.some((id) => id.getText() === tested),
		);
	});

	return new Set(matchedStrings);
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

export function replaceDestructureAliases(bindingEl: BindingElement) {
	const directIds = bindingEl.getChildrenOfKind(SyntaxKind.Identifier);

	const [nameNode, aliasNode] = directIds;

	if (!nameNode || !aliasNode) {
		return;
	}

	if (directIds.length === 2) {
		aliasNode
			.findReferencesAsNodes()
			.forEach((ref) => ref.replaceWithText(nameNode.getText()));
	}
}

export function replaceReferences(
	codeBlock: Block | SourceFile,
	replaced: string[],
	callerName: string | undefined,
) {
	let didReplace = false;

	codeBlock
		.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
		.forEach((accessExpr) => {
			if (
				replaced.includes(accessExpr.getName()) &&
				accessExpr
					.getChildrenOfKind(SyntaxKind.Identifier)[0]
					?.getText() === callerName
			) {
				const accessed = accessExpr
					.getChildrenOfKind(SyntaxKind.Identifier)
					.at(-1)
					?.getText();

				if (!accessed) {
					throw new Error('Could not find accessed identifier');
				}

				didReplace = true;
				accessExpr.replaceWithText(accessed);
			}
		});

	codeBlock
		.getDescendantsOfKind(SyntaxKind.ObjectBindingPattern)
		.forEach((bindingPattern) => {
			const toReplaceFromBinding: string[] = [];

			bindingPattern
				.getDescendantsOfKind(SyntaxKind.BindingElement)
				.forEach((bindingEl) => {
					const destructuredReplaced = bindingEl
						.getDescendantsOfKind(SyntaxKind.Identifier)
						.find((d) => replaced.includes(d.getText()));

					if (destructuredReplaced) {
						replaceDestructureAliases(bindingEl);

						toReplaceFromBinding.push(bindingEl.getText());
					}
				});

			if (toReplaceFromBinding.length) {
				didReplace = true;

				bindingPattern?.replaceWithText(
					bindingPattern
						.getText()
						.replace(
							new RegExp(
								`(,\\s*)?(${toReplaceFromBinding.join(
									'|',
								)})+(\\s*,)?`,
								'g',
							),
							(fullMatch, p1, _p2, p3) => {
								if (fullMatch && ![p1, p3].includes(fullMatch))
									return '';
								return fullMatch;
							},
						),
				);

				if (
					!bindingPattern.getDescendantsOfKind(SyntaxKind.Identifier)
						.length
				) {
					bindingPattern
						.getAncestors()
						.find(
							(a) =>
								a.getKind() === SyntaxKind.VariableDeclaration,
						)
						?.asKindOrThrow(SyntaxKind.VariableDeclaration)
						.remove();
				} else {
					bindingPattern.formatText();
				}
			}
		});

	return didReplace;
}

function shouldProcessFile(sourceFile: SourceFile) {
	return !!sourceFile
		.getImportDeclarations()
		.find((decl) =>
			decl.getModuleSpecifier().getLiteralText().startsWith('msw'),
		);
}

// https://mswjs.io/docs/migrations/1.x-to-2.x/#ctxfetch
export function handleSourceFile(sourceFile: SourceFile): string | undefined {
	if (!shouldProcessFile(sourceFile)) {
		return undefined;
	}

	sourceFile
		.getDescendantsOfKind(SyntaxKind.CallExpression)
		.filter((callExpr) => isMSWCall(sourceFile, callExpr))
		.forEach((expression) => {
			const callbackData = getCallbackData(expression);
			if (!callbackData) {
				return;
			}

			const [callbackBody, callbackParams] = callbackData;
			const [, , ctxParam] = callbackParams;

			const matchedValues = searchIdentifiers(callbackBody, ['fetch']);

			if (matchedValues.size) {
				addNamedImportDeclaration(sourceFile, 'msw', 'bypass');

				callbackBody
					.getDescendantsOfKind(SyntaxKind.CallExpression)
					.forEach((call) => {
						const [caller, , param] = call.getChildren();

						if (caller?.getText().includes('fetch')) {
							param?.replaceWithText(
								`bypass(${param.getText()})`,
							);
						}
					});

				replaceReferences(
					callbackBody,
					Array.from(matchedValues),
					ctxParam?.getName(),
				);
			}
		});

	return sourceFile.getFullText();
}
