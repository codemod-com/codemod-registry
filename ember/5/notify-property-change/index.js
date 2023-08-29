import codemodCLI from 'codemod-cli';

const {
	jscodeshift: { getParser },
} = codemodCLI;

export default function transformer(file, api) {
	const j = getParser(api);
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
