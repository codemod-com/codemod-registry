import type { FileInfo, API, Options } from 'jscodeshift';
export default function transform(
	file: FileInfo,
	api: API,
	options: Options,
): string | undefined {
	const j = api.jscodeshift;
	const root = j(file.source);

	// Find all CallExpressions
	root.find(j.CallExpression).forEach((path) => {
		// Ensure the callee is a MemberExpression
		if (path.node.callee.type === 'MemberExpression') {
			// Ensure the object is an Identifier named 'integration'
			if (
				path.node.callee.object.type === 'Identifier' &&
				path.node.callee.object.name === 'integration'
			) {
				// Ensure the property is an Identifier named 'addBuildHook'
				if (
					path.node.callee.property.type === 'Identifier' &&
					path.node.callee.property.name === 'addBuildHook'
				) {
					// Replace 'addBuildHook' with 'addBuildEventContext'
					path.node.callee.property.name = 'addBuildEventContext';
				}
			}
		}
	});

	return root.toSource();
}
