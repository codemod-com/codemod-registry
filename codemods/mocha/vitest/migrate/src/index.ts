import type { FileInfo, API } from 'jscodeshift';
export default function transform(
	file: FileInfo,
	api: API,
): string | undefined {
	const j = api.jscodeshift;
	const root = j(file.source);

	const describeIdentifiers = root.find(j.Identifier, {
		name: 'describe',
	});

	if (describeIdentifiers.length === 0) {
		return undefined;
	}

	// Create vitest import declaration
	const importedMembers = [
		j.importSpecifier(j.identifier('describe')),
		j.importSpecifier(j.identifier('it')),
	];

	// Find the import declaration for 'chai'
	const chaiImportDeclarations = root.find(j.ImportDeclaration, {
		source: {
			type: 'StringLiteral',
			value: 'chai',
		},
	});

	chaiImportDeclarations.forEach((path) => {
		path.node.specifiers?.forEach((specifier) => {
			if (j.ImportSpecifier.check(specifier)) {
				importedMembers.push(specifier);
			}
		});
	});

	chaiImportDeclarations.remove();

	root.get().node.program.body.unshift(
		j.importDeclaration(importedMembers, j.literal('vitest')),
	);

	return root.toSource();
}
