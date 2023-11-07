import {
	type BindingElement,
	type Block,
	type PropertyAccessExpression,
	type SourceFile,
	SyntaxKind,
	type CallExpression,
	type FunctionExpression,
	type ArrowFunction,
	ParameterDeclaration,
} from 'ts-morph';

// It would be nice to share these instead of duplicating the code.

export function shouldProcessFile(sourceFile: SourceFile) {
	return !!sourceFile
		.getImportDeclarations()
		.find((decl) =>
			decl.getModuleSpecifier().getLiteralText().startsWith('msw'),
		);
}

export function addNamedImportDeclaration(
	sourceFile: SourceFile,
	moduleSpecifier: string,
	name: string,
) {
	const importDeclaration =
		sourceFile.getImportDeclaration(moduleSpecifier) ||
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

export function getImportDeclarationAlias(
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

export function searchIdentifiers(
	codeBlock: Block,
	searchables: string[],
	matchCb?: (matchedVal: string) => void,
) {
	const matched = new Set<string>();
	for (const parent of (
		codeBlock.getDescendantsOfKind(
			SyntaxKind.PropertyAccessExpression,
		) as Array<PropertyAccessExpression | BindingElement>
	).concat(codeBlock.getDescendantsOfKind(SyntaxKind.BindingElement))) {
		const identifiers = parent.getDescendantsOfKind(SyntaxKind.Identifier);
		searchables
			.filter((tested) =>
				identifiers.some((id) => id.getText() === tested),
			)
			.forEach((matchedText) => {
				matched.add(matchedText);
				matchCb?.(matchedText);
			});
	}

	return matched;
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

export function isMSWCall(sourceFile: SourceFile, callExpr: CallExpression) {
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

export function getCallbackData(
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
