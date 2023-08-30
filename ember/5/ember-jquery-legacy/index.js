import codemodCLI from 'codemod-cli';

const {
	jscodeshift: { getParser },
} = codemodCLI;

export default function transformer(file, api) {
	const j = getParser(api);

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
