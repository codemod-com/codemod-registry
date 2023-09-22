import tsmorph, {
	SourceFile,
	ImportDeclaration,
	ImportSpecifier,
	CallExpression,
	Node,
	SyntaxKind,
	JsxOpeningElement,
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

const handleCallExpression = (
	callExpression: CallExpression,
	translations: Set<string>,
) => {
	const translationKey = callExpression.getArguments()[0];

	if (!Node.isStringLiteral(translationKey)) {
		return;
	}

	translations.add(translationKey.getLiteralText());
};

const handleJsxOpeningElement = (
	jsxOpeningElement: JsxOpeningElement,
	translations: Set<string>,
) => {
	jsxOpeningElement.getAttributes().forEach((attribute) => {
		if (!Node.isJsxAttribute(attribute)) {
			return;
		}

		const initializer = attribute.getInitializer();

		if (!Node.isStringLiteral(initializer)) {
			return;
		}

		translations.add(initializer.getLiteralText());
	});
};

const handleTransNamedImport = (
	importSpecifier: ImportSpecifier,
	translations: Set<string>,
) => {
	const nameNode = importSpecifier.getNameNode();

	nameNode.findReferencesAsNodes().forEach((reference) => {
		const parent = reference.getParent();

		if (!Node.isJsxOpeningElement(parent)) {
			return;
		}

		handleJsxOpeningElement(parent, translations);
	});
};

const handleImportDeclaration = (
	importDeclaration: ImportDeclaration,
	translations: Set<string>,
) => {
	const moduleSpecifierText = importDeclaration
		.getModuleSpecifier()
		.getLiteralText();

	if (moduleSpecifierText === 'next-i18next') {
		const transNamedImport = importDeclaration
			.getNamedImports()
			.find((namedImport) => namedImport.getName() === 'Trans');

		if (transNamedImport) {
			handleTransNamedImport(transNamedImport, translations);
		}
	}
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

	// handle t and language callExpressions
	sourceFile
		.getDescendantsOfKind(SyntaxKind.CallExpression)
		.filter((callExpression) => {
			const expr = callExpression.getExpression();

			return (
				Node.isIdentifier(expr) &&
				['t', 'language'].includes(expr.getText())
			);
		})
		.forEach((callExpression) => {
			handleCallExpression(callExpression, translations);
		});

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
