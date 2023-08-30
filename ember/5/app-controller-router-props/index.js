/**
 * This code is based on a public codemod, which is subject to the original license terms.
 * Original codemod: https://github.com/ember-codemods/ember-3x-codemods/blob/master/transforms/app-controller-router-props/index.js
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

	root.find(j.MemberExpression, {
		object: { type: 'ThisExpression' },
		property: {
			name: 'currentRouteName',
		},
	})
		//.forEach(p => console.log(p.parentPath.parentPath))
		.replaceWith(() => {
			root.find(j.ExportDefaultDeclaration).forEach((p) => {
				//console.log(p.value.declaration.arguments[0].properties);
				let props = p.value.declaration.arguments[0].properties;
				props.unshift(
					j.property(
						'init',
						j.identifier('router'),
						j.callExpression(j.identifier('service'), [
							j.literal('router'),
						]),
					),
				);
			});

			return j.memberExpression(
				j.memberExpression(
					j.thisExpression(),
					j.identifier('router'),
					false,
				),
				j.identifier('currentRouteName'),
				false,
			);
		});

	return root.toSource();
}
