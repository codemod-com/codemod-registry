import type { FileInfo, API } from 'jscodeshift';

export default function transform(
	file: FileInfo,
	api: API,
): string | undefined {
	const j = api.jscodeshift;
	const root = j(file.source);

	// Find the import declaration for 'chai'
	const chaiImport = root.find(j.ImportDeclaration, {
		source: {
			type: 'Literal',
			value: 'chai',
		},
	});

	// Create vitest import declaration
	const vitestImport = j.importDeclaration(
		[
			j.importSpecifier(j.identifier('describe')),
			j.importSpecifier(j.identifier('it')),
			j.importSpecifier(j.identifier('expect')),
		],
		j.literal('vitest'),
	);

	// If chai import is found, replace it with 'vitest'
	if (chaiImport.length) {
		chaiImport.replaceWith(vitestImport);
	} else {
		// If chai import is not found, add 'vitest' import at the top of the file
		root.get().node.program.body.unshift(vitestImport);
	}

	return root.toSource();
}
