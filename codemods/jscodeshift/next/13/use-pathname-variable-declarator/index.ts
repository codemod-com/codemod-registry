import { API, FileInfo, Options } from 'jscodeshift';

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	const j = api.jscodeshift;
	const root = j(file.source);

	let dirtyFlag = false;

	root.find(j.VariableDeclarator, {
		id: { name: 'pathname' },
		init: {
			property: { name: 'pathname' },
		},
	}).replaceWith(() => {
		dirtyFlag = true;

		return j.variableDeclarator(
			j.identifier('pathname'),
			j.callExpression(j.identifier('usePathname'), []),
		);
	});

	if (!dirtyFlag) {
		return null;
	}

	const importDeclaration = j.importDeclaration(
		[
			j.importSpecifier(
				j.identifier('usePathname'),
				j.identifier('usePathname'),
			),
		],
		j.stringLiteral('next/navigation'),
	);

	const body = root.get().value.program.body;
	body.unshift(importDeclaration);

	return root.toSource();
}
