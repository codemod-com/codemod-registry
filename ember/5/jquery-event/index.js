import codemodCLI from 'codemod-cli';

const {
	jscodeshift: { getParser },
} = codemodCLI;

export default function transformer(file, api) {
	const j = getParser(api);

	const root = j(file.source);
	root.find(j.MemberExpression, {
		object: {
			type: 'MemberExpression',
			object: {
				name: 'event',
			},
			property: {
				name: 'originalEvent',
			},
		},
	}).replaceWith((path) => {
		return j.memberExpression(
			j.identifier(path.value.object.object.name),
			j.identifier(path.value.property.name),
			false,
		);
	});

	return root.toSource();
}
