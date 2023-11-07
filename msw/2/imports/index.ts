import { SyntaxKind, type ImportSpecifier, type SourceFile } from 'ts-morph';

function addNamedImportDeclaration(
	sourceFile: SourceFile,
	moduleSpecifier: string,
	name: string,
): ImportSpecifier {
	const importDeclaration =
		sourceFile.getImportDeclaration(moduleSpecifier) ??
		sourceFile.addImportDeclaration({ moduleSpecifier });

	const existing = importDeclaration
		.getNamedImports()
		.find((specifier) => specifier.getName() === name);

	return existing ?? importDeclaration.addNamedImport({ name });
}

function aliasAwareRename(specifier: ImportSpecifier, name: string) {
	if (specifier.getAliasNode()) {
		specifier.getNameNode().replaceWithText(name);
	} else {
		specifier.getNameNode().rename(name);
	}

	return specifier;
}

function shouldProcessFile(sourceFile: SourceFile): boolean {
	return (
		sourceFile
			.getImportDeclarations()
			.find((decl) =>
				decl.getModuleSpecifier().getLiteralText().startsWith('msw'),
			) !== undefined
	);
}

export function handleSourceFile(sourceFile: SourceFile): string | undefined {
	if (!shouldProcessFile(sourceFile)) {
		return undefined;
	}

	sourceFile
		.getImportDeclarations()
		.filter((d) => d.getModuleSpecifierValue() === 'msw')
		.forEach((declaration) => {
			// https://mswjs.io/docs/migrations/1.x-to-2.x/#worker-imports
			const setupWorkerImport = declaration
				.getNamedImports()
				.find((specifier) => specifier.getName() === 'setupWorker');

			if (setupWorkerImport) {
				setupWorkerImport.remove();
				if (!declaration.getNamedImports().length) {
					declaration.remove();
				}

				addNamedImportDeclaration(
					sourceFile,
					'msw/browser',
					'setupWorker',
				);
			}

			if (declaration.wasForgotten()) {
				return;
			}

			// https://mswjs.io/docs/migrations/1.x-to-2.x/#response-resolver-arguments (only the import names)
			declaration
				.getNamedImports()
				.filter((specifier) =>
					['rest', 'RestHandler'].includes(specifier.getName()),
				)
				.forEach((specifier) => {
					const importName = specifier.getName();
					aliasAwareRename(
						specifier,
						importName === 'rest' ? 'http' : 'HttpHandler',
					);

					// Apparently can be used as a constructor
					// if (
					// 	importName === 'HttpHandler' &&
					// 	!specifier.isTypeOnly()
					// ) {
					// 	specifier.setIsTypeOnly(true);
					// }
				});

			// Not generic anymore
			sourceFile
				.getDescendantsOfKind(SyntaxKind.TypeReference)
				.filter((tr) => tr.getText().startsWith('HttpHandler'))
				.forEach((tr) => {
					if (tr.getText() !== 'HttpHandler') {
						tr.replaceWithText('HttpHandler');
					}
				});

			// Remove old imports
			declaration
				.getNamedImports()
				.filter((s) => ['MockedRequest'].includes(s.getText()))
				.forEach((specifier) => specifier.remove());
		});

	return sourceFile.getFullText();
}
