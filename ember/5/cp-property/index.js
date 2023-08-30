/**
 * This code is based on a public codemod, which is subject to the original license terms.
 * Original codemod: https://github.com/ember-codemods/ember-3x-codemods/blob/master/transforms/cp-property/index.js
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
			property: { name: 'property' },
		},
	})
		//.forEach(p => console.log(p))
		.replaceWith((path) => {
			let args = [...path.value.arguments].concat(
				path.value.callee.object.arguments,
			);
			return j.callExpression(j.identifier('computed'), args);
		});

	return root.toSource();
}
