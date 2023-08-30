/**
 * This code is based on a public codemod, which is subject to the original license terms.
 * Original codemod: https://github.com/ember-codemods/ember-3x-codemods/blob/master/transforms/deprecate-merge/index.js
 *
 * License: MIT
 * License URL: https://opensource.org/licenses/MIT
 */

export default function transformer(file, api) {
	const j = api.jscodeshift;
	const root = j(file.source);

	root.find(j.CallExpression, {
		callee: {
			name: 'merge',
		},
	}).forEach((path) => {
		path.value.callee.name = 'assign';
	});

	root.find(j.ImportDeclaration, {
		specifiers: [{ local: { name: 'merge' } }],
	}).forEach((i) => {
		i.value.specifiers
			.filter((s) => {
				return s.local.name === 'merge';
			})
			.forEach((t) => {
				t.local.name = 'assign';
			});
	});
	return root.toSource();
}
