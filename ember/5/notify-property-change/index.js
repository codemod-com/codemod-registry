/**
 * This code is based on a public codemod, which is subject to the original license terms.
 * Original codemod: https://github.com/ember-codemods/ember-3x-codemods/blob/master/transforms/notify-property-change/index.js
 *
 * License: MIT
 * License URL: https://opensource.org/licenses/MIT
 */

export default function transformer(file, api) {
	const j = api.jscodeshift;
	const root = j(file.source);

	root.find(j.ExpressionStatement, {
		expression: {
			callee: {
				property: {
					name: 'propertyWillChange',
				},
			},
		},
	}).forEach((path) => {
		j(path).remove();
	});

	root.find(j.MemberExpression, {
		property: {
			name: 'propertyDidChange',
		},
	}).forEach((path) => {
		path.value.property.name = 'notifyPropertyChange';
	});
	return root.toSource();
}
