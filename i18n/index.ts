import tsmorph, {
	SourceFile,
	ImportDeclaration,
	ImportSpecifier,
	CallExpression,
	Node,
	SyntaxKind,
} from 'ts-morph';

import type {
	Repomod,
	UnifiedFileSystem,
} from '@intuita-inc/repomod-engine-api';

// eslint-disable-next-line @typescript-eslint/ban-types
type Dependencies = Readonly<{
	tsmorph: typeof tsmorph;
	unifiedFileSystem: UnifiedFileSystem;
}>;

const handleTReference = (reference: Node, translations: Set<string>) => {
	const parent = reference.getParent();

	if (!(Node.isIdentifier(reference) && Node.isCallExpression(parent))) {
		return;
	}

	const translationKey = parent.getArguments()[0];

	if (!Node.isStringLiteral(translationKey)) {
		return;
	}

	translations.add(translationKey.getLiteralText());
};

const handleCallExpression = (
	callExpression: CallExpression,
	translations: Set<string>,
) => {
	const maybeVariableDeclaration = callExpression.getParent();

	if (Node.isVariableDeclaration(maybeVariableDeclaration)) {
		const nameNode = maybeVariableDeclaration.getNameNode();

		if (Node.isObjectBindingPattern(nameNode)) {
			nameNode.getElements().forEach((el) => {
				const nameNode = el.getNameNode();

				if (
					!(Node.isIdentifier(nameNode) && nameNode.getText() === 't')
				) {
					return;
				}

				nameNode.findReferencesAsNodes().forEach((reference) => {
					handleTReference(reference, translations);
				});
			});
		}
	}
};

const handleImportSpecifier = (
	importSpecifier: ImportSpecifier,
	translations: Set<string>,
) => {
	if (importSpecifier.getName() !== 'useLocale') {
		return;
	}

	const nameNode = importSpecifier.getNameNode();

	nameNode.findReferencesAsNodes().forEach((reference) => {
		const parent = reference.getParent();

		if (!Node.isCallExpression(parent)) {
			return;
		}

		handleCallExpression(parent, translations);
	});
};

const handleImportDeclaration = (
	importDeclaration: ImportDeclaration,
	translations: Set<string>,
) => {
	if (
		importDeclaration.getModuleSpecifier().getLiteralText() !==
		'@calcom/lib/hooks/useLocale'
	) {
		return;
	}

	importDeclaration
		.getNamedImports()
		.forEach((importSpecifier) =>
			handleImportSpecifier(importSpecifier, translations),
		);
};

const handleSourceFile = (
	sourceFile: SourceFile,
	translations: Set<string>,
) => {
	sourceFile
		.getImportDeclarations()
		.forEach((importDeclaration) =>
			handleImportDeclaration(importDeclaration, translations),
		);
	return sourceFile;
};

const buildSourceFile = (
	tsmorph: Dependencies['tsmorph'],
	data: string,
	path: string,
) => {
	const project = new tsmorph.Project({
		useInMemoryFileSystem: true,
		skipFileDependencyResolution: true,
		compilerOptions: {
			allowJs: true,
		},
	});

	return project.createSourceFile(String(path), String(data));
};

const handleLocaleFile = (
	sourceFile: SourceFile,
	translations: Set<string>,
) => {
	const objectLiteralExpression = sourceFile.getDescendantsOfKind(
		SyntaxKind.ObjectLiteralExpression,
	)[0];

	objectLiteralExpression?.getProperties().forEach((propertyAssignment) => {
		if (!Node.isPropertyAssignment(propertyAssignment)) {
			return;
		}

		const nameNode = propertyAssignment.getNameNode();

		if (!Node.isStringLiteral(nameNode)) {
			return;
		}

		const name = nameNode.getLiteralText();

		if (!translations.has(name)) {
			propertyAssignment.remove();
		}
	});
};

export const repomod: Repomod<Dependencies, Record<string, unknown>> = {
	includePatterns: ['**/*.{js,jsx,ts,tsx,cjs,mjs,json}'],
	excludePatterns: ['**/node_modules/**'],
	initializeState: async (_, previousState) => {
		return (
			previousState ?? {
				translations: new Set(),
				translationsCollected: false,
			}
		);
	},
	handleFinish: async (_, state) => {
		if (state === null || state.translationsCollected) {
			return { kind: 'noop' };
		}

		state.translationsCollected = true;

		return {
			kind: 'restart',
		};
	},
	handleData: async (api, path, data, options, state) => {
		if (state === null) {
			return {
				kind: 'noop',
			};
		}

		const translations = state.translations as Set<string>;

		if (!state.translationsCollected) {
			const { tsmorph } = api.getDependencies();

			handleSourceFile(
				buildSourceFile(tsmorph, data, path),
				translations,
			);
		}

		if (
			state.translationsCollected &&
			translations.size !== 0 &&
			path.includes('public/static/locales')
		) {
			const sourceFile = buildSourceFile(tsmorph, `(${data})`, path);
			handleLocaleFile(sourceFile, translations);
			const fullText = sourceFile.getFullText();

			return {
				kind: 'upsertData',
				path,
				data: sourceFile.getFullText().slice(1, fullText.length - 1),
			};
		}

		return {
			kind: 'noop',
		};
	},
};
