import { API, FileInfo, Options, Transform } from 'jscodeshift';

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	const j = api.jscodeshift;
	const root = j(file.source);

	let dirtyFlag = false;

	const hasImportDeclarations = root
		.find(j.ImportDeclaration, {
			specifiers: [
				{
					imported: {
						type: 'Identifier',
						name: 'useRouter',
					},
				},
			],
			source: {
				value: 'next/router',
			},
		})
		.size();

	if (!hasImportDeclarations) {
		return undefined;
	}

	const importDeclaration = j.importDeclaration(
		[
			j.importSpecifier(
				j.identifier('useSearchParams'),
				j.identifier('useSearchParams'),
			),
		],
		j.stringLiteral('next/navigation'),
	);

	root.find(j.Program).forEach((program) => {
		program.value.body.unshift(importDeclaration);
	});

	return root.toSource();
}

transformer satisfies Transform;
