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
			property: { name: 'observes' },
		},
	}).replaceWith((path) => {
		return j.callExpression(
			j.identifier('observer'),
			path.value.arguments.concat(path.value.callee.object),
		);
	});

	return root.toSource();
}
