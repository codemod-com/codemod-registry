/**
 * This code is based on a public codemod, which is subject to the original license terms.
 * Original codemod: https://github.com/ember-codemods/ember-3x-codemods/blob/master/transforms/object-new-constructor/index.js
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

	root.find(j.NewExpression, {
		callee: {
			name: 'EmberObject',
		},
	})
		//.forEach(p => console.log(p))
		.replaceWith((path) => {
			return j.callExpression(
				j.memberExpression(
					j.identifier('EmberObject'),
					j.identifier('create'),
					false,
				),
				path.value.arguments,
			);
		});

	return root.toSource();
}
