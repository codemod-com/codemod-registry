import { ModifyFunction } from './types.js';

export const addFactoryFunctionToMock: ModifyFunction = (root, j) => {
	root.find(j.CallExpression, {
		callee: {
			object: { type: 'Identifier', name: 'jest' },
			property: { type: 'Identifier', name: 'setMock' },
		},
	}).forEach((path) => {
		const { arguments: args } = path.value;

		if (args.length < 2) {
			return;
		}

		const moduleExport = args[1];

		if (moduleExport.type !== 'ObjectExpression') {
			return;
		}

		args[1] = j.arrowFunctionExpression([], moduleExport);
	});
};
