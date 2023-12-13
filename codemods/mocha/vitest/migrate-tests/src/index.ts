import type { FileInfo, API, ImportDeclaration } from 'jscodeshift';

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

	const comments: NonNullable<ImportDeclaration['comments']> = [];

	chaiImportDeclarations.forEach((path) => {
		path.node.comments?.forEach((commentKind) => {
			comments.push(commentKind);
		});

		path.node.specifiers?.forEach((specifier) => {
			if (j.ImportSpecifier.check(specifier)) {
				importedMembers.push(specifier);
			}
		});
	});

	chaiImportDeclarations.remove();

	const program = root.find(j.Program).nodes()[0];

	if (!program) {
		return undefined;
	}

	const index = program.body.findIndex(
		(value) => value.type === 'ImportDeclaration',
	);

	program.body.splice(
		index + 1,
		0,
		j.importDeclaration.from({
			comments,
			source: j.literal('vitest'),
			specifiers: importedMembers,
		}),
	);

	return root.toSource();
}
