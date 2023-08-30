/**
 * This code is based on a public codemod, which is subject to the original license terms.
 * Original codemod: https://github.com/ember-codemods/ember-3x-codemods/blob/master/transforms/ember-jquery-legacy/index.js
 *
 * License: MIT
 * License URL: https://opensource.org/licenses/MIT
 */

export default function transformer(file, api) {
	const j = api.jscodeshift;

	const root = j(file.source);

	root.find(j.MemberExpression, {
		object: {
			name: 'event',
		},
		property: {
			name: 'originalEvent',
		},
	}).replaceWith((path) => {
		let computedImport = j.importDeclaration(
			[j.importSpecifier(j.identifier('normalizeEvent'))],
			j.literal('ember-jquery-legacy'),
		);

		let body = root.get().value.program.body;
		body.unshift(computedImport);
		return j.callExpression(j.identifier('normalizeEvent'), [
			path.value.object,
		]);
	});

	return root.toSource();
}
