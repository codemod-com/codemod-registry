import type { Identifier } from 'jscodeshift';
import type { ModifyFunction } from './types.js';

const jestFailsApisName = 'failing';
const vitestFailsApisName = 'fails';

export const replaceTestApiFailing: ModifyFunction = (root, j): void => {
	for (const testApiName of ['it', 'test']) {
		// Replace `(it|test).failing` with `(it|test).fails`
		root.find(j.MemberExpression, {
			object: { type: 'Identifier', name: testApiName },
			property: { type: 'Identifier', name: jestFailsApisName },
		}).forEach((path) => {
			(path.node.property as Identifier).name = vitestFailsApisName;
			return path;
		});

		// Replace `(it|test).(only|skip).failing` with `(it|test).(only|skip).fails`
		for (const testApiModifierName of ['only', 'skip']) {
			root.find(j.MemberExpression, {
				object: {
					object: { type: 'Identifier', name: testApiName },
					property: {
						type: 'Identifier',
						name: testApiModifierName,
					},
				},
				property: { type: 'Identifier', name: jestFailsApisName },
			}).forEach((path) => {
				(path.node.property as Identifier).name = vitestFailsApisName;
				return path;
			});
		}
	}
};

export const replaceTestApiFit: ModifyFunction = (root, j): void => {
	const jestApiName = 'fit';
	const vitestApiObject = j.memberExpression(
		j.identifier('it'),
		j.identifier('only'),
	);

	// Replace `fit` with `it.only`
	root.find(j.CallExpression, {
		callee: { type: 'Identifier', name: jestApiName },
	}).forEach((path) => {
		path.node.callee = vitestApiObject;
		return path;
	});

	// Replace `fit.(each|failing)` with `it.only.(each|failing)`
	for (const fitModifierName of ['each', 'failing']) {
		root.find(j.MemberExpression, {
			object: { type: 'Identifier', name: jestApiName },
			property: { type: 'Identifier', name: fitModifierName },
		}).forEach((path) => {
			path.node.object = vitestApiObject;
			return path;
		});
	}
};
