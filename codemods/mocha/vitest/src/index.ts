import type { FileInfo, API } from 'jscodeshift';

const isNeitherNullNorUndefined = <T>(
	t: NonNullable<T> | null | undefined,
): t is NonNullable<T> => t !== null && t !== undefined;

export default function transform(
	file: FileInfo,
	api: API,
): string | undefined {
	const j = api.jscodeshift;
	const root = j(file.source);

	const describeCallExpressions = root.find(j.CallExpression, {
		callee: {
			type: 'Identifier',
			name: 'describe',
		},
	});

	if (describeCallExpressions.length === 0) {
		return undefined;
	}

	const transformedExpressions = j.arrayExpression([]);

	// Find the describe function call
	root.find(j.CallExpression, {
		callee: {
			type: 'Identifier',
			name: 'describe',
		},
	}).forEach((path) => {
		const [description, callback] = path.node.arguments;

		// Ensure the callback is a function
		if (
			callback.type !== 'ArrowFunctionExpression' &&
			callback.type !== 'FunctionExpression'
		) {
			return;
		}

		// Ensure the description is a string literal
		if (description.type !== 'StringLiteral') {
			return;
		}

		// Find the it function call inside the describe callback and replace it with test function call
		j(callback)
			.find(j.CallExpression, {
				callee: {
					type: 'Identifier',
					name: 'it',
				},
			})
			.forEach((itPath) => {
				const [itDescription, itCallback] = itPath.node.arguments;

				// Ensure the itCallback is a function
				if (
					itCallback.type !== 'ArrowFunctionExpression' &&
					itCallback.type !== 'FunctionExpression'
				) {
					return;
				}

				// Ensure the itDescription is a string literal
				if (itDescription.type !== 'StringLiteral') {
					return;
				}

				// Combine the describe and it descriptions
				const testDescription = j.binaryExpression(
					'+',
					j.stringLiteral(description.value + ' - '),
					j.stringLiteral(itDescription.value),
				);

				// Return the new test function call
				transformedExpressions.elements.push(
					j.callExpression(j.identifier('test'), [
						testDescription,
						itCallback,
					]),
				);
			});

		// Remove the original describe block
		path.replace();
	});

	const transformedExpressionStatements = transformedExpressions.elements
		.map((element) => {
			if (
				element === null ||
				j.SpreadElement.check(element) ||
				j.RestElement.check(element)
			) {
				return null;
			}

			return j.expressionStatement(element);
		})
		.filter(isNeitherNullNorUndefined);

	root.find(j.Program).forEach((programPath) => {
		// Iterate over elements of transformedExpressions manually and push each into the body
		transformedExpressionStatements.forEach((statement) => {
			programPath.node.body.push(statement);
		});
	});

	// Import `test` from 'vitest' package
	root.find(j.ImportDeclaration).insertAfter(
		j.importDeclaration(
			[j.importSpecifier(j.identifier('test'))],
			j.literal('vitest'),
		),
	);

	return root.toSource();
}
