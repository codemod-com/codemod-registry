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

	// Remove mocha imports and references
	const toRemove: string[] = [];
	const mochaImport = root.find(j.ImportDeclaration, {
		source: { type: 'StringLiteral', value: 'mocha' },
	});

	mochaImport.forEach((declaration) => {
		declaration.node.specifiers?.forEach((specifier) => {
			if (j.ImportSpecifier.check(specifier) && specifier.local?.name) {
				toRemove.push(specifier.local.name);
			}
		});
		j(declaration).remove();
	});

	toRemove.forEach((spec) => {
		root.find(j.Identifier, { name: spec }).forEach((identifier) => {
			j(identifier).remove();
		});

		root.find(j.TSTypeAnnotation, {
			typeAnnotation: {
				typeName: { type: 'Identifier', name: 'Context' },
			},
		}).forEach((annotation) => {
			j(annotation).remove();
		});
	});

	return root.toSource();
}
