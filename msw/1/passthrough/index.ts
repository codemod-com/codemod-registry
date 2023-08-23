import type { FileInfo, API } from 'jscodeshift';
export default function transform(
	file: FileInfo,
	api: API,
	options: Options,
): string | undefined {
	const j = api.jscodeshift;
	const root = j(file.source);

	// Find all call expressions to 'req.passthrough'
	const passthroughCallExpressions = root.find(j.CallExpression, {
		callee: {
			type: 'MemberExpression',
			property: {
				type: 'Identifier',
				name: 'passthrough',
			},
		},
	});

	// If there are no 'req.passthrough()' calls, return the original source
	if (passthroughCallExpressions.size() === 0) {
		return file.source;
	}

	// Find all import declarations from 'msw'
	const mswImportDeclarations = root.find(j.ImportDeclaration, {
		source: {
			type: 'StringLiteral',
			value: 'msw',
		},
	});

	// Add 'passthrough' to the import specifiers if it doesn't exist
	mswImportDeclarations.forEach((path) => {
		const specifiers = path.node.specifiers;
		const hasPassthrough = specifiers.some(
			(specifier) =>
				specifier.type === 'ImportSpecifier' &&
				specifier.imported.name === 'passthrough',
		);

		if (!hasPassthrough) {
			specifiers.push(j.importSpecifier(j.identifier('passthrough')));
		}
	});

	// Replace 'req.passthrough()' with 'passthrough()'
	passthroughCallExpressions.replaceWith(() =>
		j.callExpression(j.identifier('passthrough'), []),
	);

	return root.toSource();
}
