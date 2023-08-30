/**
 * This code is based on a public codemod, which is subject to the original license terms.
 * Original codemod: https://github.com/ember-codemods/ember-3x-codemods/blob/master/transforms/cp-volatile/index.js
 *
 * License: MIT
 * License URL: https://opensource.org/licenses/MIT
 */

import codemodCLI from 'codemod-cli';

const {
	jscodeshift: { getParser },
} = codemodCLI;

export default function transformer(file, api) {
	const j = getParser(api);

	const root = j(file.source);

	root.find(j.CallExpression, {
		callee: {
			type: 'MemberExpression',
			object: { callee: { name: 'computed' } },
			property: { name: 'volatile' },
		},
	})
		//.forEach(p => console.log(p.value.callee.object.arguments[0].body))
		.map((p) => p.parentPath)
		.replaceWith((path) => {
			// Find the function expression in the arguments
			const fnExp = path.value.value.callee.object.arguments.find(
				(a) => a.type === 'FunctionExpression',
			);
			const fnBody = fnExp.body;
			return j.property(
				'get',
				j.identifier(path.value.key.name),
				j.functionExpression(
					j.identifier(path.value.key.name),
					[],
					fnBody,
					false,
					false,
				),
			);
		});

	return root.toSource();
}
