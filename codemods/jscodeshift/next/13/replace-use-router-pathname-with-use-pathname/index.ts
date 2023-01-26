import { API, FileInfo, Options, Transform } from 'jscodeshift';

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	const j = api.jscodeshift;
	const root = j(file.source);

	let dirtyFlag = false;

	root.find(j.VariableDeclarator, {
		id: {
			type: 'Identifier',
			name: 'pathname',
		},
		init: {
			type: 'MemberExpression',
			property: {
				type: 'Identifier',
				name: 'pathname',
			},
		},
	}).replaceWith(() => {
		dirtyFlag = true;

		return j.variableDeclarator(
			j.identifier('pathname'),
			j.callExpression(j.identifier('usePathname'), []),
		);
	});

	if (!dirtyFlag) {
		return undefined;
	}

	return root.toSource();
}

transformer satisfies Transform;
