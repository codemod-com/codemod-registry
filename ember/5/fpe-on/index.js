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
			object: { type: 'FunctionExpression' },
			property: { name: 'on' },
		},
	}).replaceWith((path) => {
		let onImport = j.importDeclaration(
			[j.importSpecifier(j.identifier('on'))],
			j.literal('@ember/object/evented'),
		);

		let body = root.get().value.program.body;
		body.unshift(onImport);

		return j.callExpression(
			j.identifier('on'),
			path.value.arguments.concat(path.value.callee.object),
		);
	});

	return root.toSource({ quote: 'single' });
}
