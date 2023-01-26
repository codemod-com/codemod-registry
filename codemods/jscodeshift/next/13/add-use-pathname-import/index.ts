import { API, FileInfo, Options } from 'jscodeshift';

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	const j = api.jscodeshift;
	const root = j(file.source);

	const importDeclarations = root.find(j.ImportDeclaration, {
		type: 'ImportDeclaration',
		specifiers: [
			{
				type: 'ImportSpecifier',
				imported: {
					type: 'Identifier',
					name: 'usePathname',
				},
			},
		],
	});

	if (importDeclarations.size()) {
		return undefined;
	}

	const size = root
		.find(j.CallExpression, {
			callee: {
				name: 'usePathname',
			},
		})
		.size();

	if (!size) {
		return undefined;
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

	root.find(j.Program).forEach((program) => {
		program.value.body.unshift(importDeclaration);
	});

	return root.toSource();
}
