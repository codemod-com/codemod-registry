import codemodCLI from 'codemod-cli';

const {
	jscodeshift: { getParser },
} = codemodCLI;

export default function transformer(file, api) {
	const j = getParser(api);
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
