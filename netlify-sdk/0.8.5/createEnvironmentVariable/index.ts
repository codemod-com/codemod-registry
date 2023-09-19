import type { FileInfo, API } from 'jscodeshift';
export default function transform(
	file: FileInfo,
	api: API,
): string | undefined {
	const j = api.jscodeshift;
	const root = j(file.source);

	let dirtyFlag = false;

	// Find all CallExpression nodes
	root.find(j.CallExpression).forEach((path) => {
		if (
			path.node.type !== 'CallExpression' ||
			path.node.callee.type !== 'Identifier' ||
			path.node.callee.name !== 'createEnvironmentVariable'
		) {
			return;
		}

		// Create an object expression from the arguments
		const objectExpression = j.objectExpression(
			path.node.arguments
				.map((arg, i) => {
					// Create a property from the identifier
					if (i > 3 || arg.type === 'SpreadElement') {
						return null;
					}

					const name =
						['accountId', 'siteId', 'key', 'values'][i] ?? 'error';

					return j.property.from({
						kind: 'init',
						key: j.identifier.from({ name }),
						value: arg,
					});
				})
				.filter((property) => property !== null),
		);

		// Replace the arguments with the new object expression
		path.node.arguments = [objectExpression];

		dirtyFlag = true;
	});

	return dirtyFlag ? root.toSource() : undefined;
}
