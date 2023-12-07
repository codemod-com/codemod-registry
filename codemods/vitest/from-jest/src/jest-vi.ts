import type { ModifyFunction } from './types.js';

const apiNamesRecord: Record<string, string> = {
	createMockFromModule: 'importMock',
	deepUnmock: 'unmock',
	genMockFromModule: 'importMock',
	requireActual: 'importActual',
	requireMock: 'importMock',
	setMock: 'mock',
};
const apiNamesToMakeAsync = [
	'genMockFromModule',
	'createMockFromModule',
	'requireActual',
	'requireMock',
];

export const replaceJestObjectWithVi: ModifyFunction = (root, j): void => {
	// Replace `jest` with `vi`
	root.find(j.MemberExpression, {
		object: { type: 'Identifier', name: 'jest' },
	}).forEach((path) => {
		if (path.node.property.type === 'Identifier') {
			const propertyName = path.node.property.name;

			if (propertyName === 'enableAutomock') {
				throw new Error(
					`The automocking API "${propertyName}" is not supported in vitest.\n` +
						'See https://vitest.dev/guide/migration.html',
				);
			}

			if (propertyName === 'disableAutomock') {
				j(path.parentPath).remove();
				return;
			}

			if (apiNamesRecord[propertyName])
				path.node.property.name = apiNamesRecord[propertyName];

			if (apiNamesToMakeAsync.includes(propertyName)) {
				// Add await to the call expression
				j(path.parentPath).replaceWith((path) =>
					j.awaitExpression(path.value),
				);

				// Add async to the function
				let parentPath = path.parentPath;
				while (
					!['FunctionExpression', 'ArrowFunctionExpression'].includes(
						parentPath.value.type,
					)
				)
					parentPath = parentPath.parentPath;
				parentPath.value.async = true;
			}
		}

		path.node.object = j.identifier('vi');
		return path;
	});
};
