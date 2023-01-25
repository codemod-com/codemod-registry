import { API, FileInfo, Options } from 'jscodeshift';

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	const j = api.jscodeshift;
	const root = j(file.source);

	const size = root
		.find(j.CallExpression, {
			callee: {
				name: 'usePathname',
			},
		})
		.size();

	if (!size) {
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
