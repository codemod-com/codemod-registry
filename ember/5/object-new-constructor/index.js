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
