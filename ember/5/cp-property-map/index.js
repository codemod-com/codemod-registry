/**
 * This code is based on a public codemod, which is subject to the original license terms.
 * Original codemod: https://github.com/ember-codemods/ember-3x-codemods/blob/master/transforms/cp-property-map/index.js
 *
 * License: MIT
 * License URL: https://opensource.org/licenses/MIT
 */

export default function transformer(file, api) {
	const j = api.jscodeshift;

	const root = j(file.source);

	root.find(j.CallExpression, {
		callee: {
			type: 'MemberExpression',
			object: { callee: { name: 'map' } },
			property: { name: 'property' },
		},
	}).replaceWith((path) => {
		let calleeArgs = path.value.callee.object.arguments;
		let first = calleeArgs.slice(0, calleeArgs.length - 1);
		let last = calleeArgs[calleeArgs.length - 1];
		let args = [].concat(
			first,
			j.arrayExpression(path.value.arguments),
			last,
		);

		return j.callExpression(j.identifier('map'), args);
	});

	return root.toSource();
}
