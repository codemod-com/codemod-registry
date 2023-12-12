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
	const importedMembers = [
		j.importSpecifier(j.identifier('describe')),
		j.importSpecifier(j.identifier('it')),
	];

	if (chaiImport.length) {
		chaiImport.forEach((path) => {
			path.node.specifiers.forEach((specifier) => {
				if (j.ImportSpecifier.check(specifier)) {
					importedMembers.push(specifier);
				}
			});
			path.replace();
		});
	}
	const vitestImport = j.importDeclaration(
		importedMembers,
		j.literal('vitest'),
	);

	root.get().node.program.body.unshift(vitestImport);

	return root.toSource();
}
