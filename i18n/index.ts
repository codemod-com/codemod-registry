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

const TRANSLATION_FUNCTION_NAMES = [
	't',
	'language',
	'translate',
	'getTextBody',
] as const;
type TranslationFunctionNames = (typeof TRANSLATION_FUNCTION_NAMES)[number];

const isTranslationFunctionName = (
	str: string,
): str is TranslationFunctionNames =>
	TRANSLATION_FUNCTION_NAMES.includes(str as TranslationFunctionNames);

const handleCallExpression = (
	callExpression: CallExpression,
	name: TranslationFunctionNames,
	state: State,
) => {
	const [arg1, arg2] = callExpression.getArguments();

	const translationKeyArgs = name === 'getTextBody' ? [arg1, arg2] : [arg1];

	translationKeyArgs.forEach((translationKeyArg) => {
		if (Node.isStringLiteral(translationKeyArg)) {
			state.translations.add(translationKeyArg.getLiteralText());
		}

		if (Node.isJsxExpression(translationKeyArg)) {
			const expression = translationKeyArg.getExpression();

			if (Node.isTemplateExpression(expression)) {
				const templateHead = expression.getHead();

				state.keyBeginnings.add(templateHead.compilerNode.text);
				return;
			}

			return;
		}
	});
};

const handleJsxOpeningElement = (
	jsxOpeningElement: JsxOpeningElement,
	state: State,
) => {
	jsxOpeningElement.getAttributes().forEach((attribute) => {
		if (!Node.isJsxAttribute(attribute)) {
			return;
		}

		const initializer = attribute.getInitializer();

		if (Node.isStringLiteral(initializer)) {
			state.translations.add(initializer.getLiteralText());
			return;
		}

		if (Node.isJsxExpression(initializer)) {
			const expression = initializer.getExpression();

			if (Node.isTemplateExpression(expression)) {
				const templateHead = expression.getHead();

				state.keyBeginnings.add(templateHead.compilerNode.text);
				return;
			}
			return;
		}
	});
};

const handleTransNamedImport = (
	importSpecifier: ImportSpecifier,
	state: State,
) => {
	const nameNode = importSpecifier.getNameNode();

	nameNode.findReferencesAsNodes().forEach((reference) => {
		const parent = reference.getParent();

		if (!Node.isJsxOpeningElement(parent)) {
			return;
		}

		handleJsxOpeningElement(parent, state);
	});
};

const handleImportDeclaration = (
	importDeclaration: ImportDeclaration,
	state: State,
) => {
	const moduleSpecifierText = importDeclaration
		.getModuleSpecifier()
		.getLiteralText();

	if (moduleSpecifierText === 'next-i18next') {
		const transNamedImport = importDeclaration
			.getNamedImports()
			.find((namedImport) => namedImport.getName() === 'Trans');

		if (transNamedImport) {
			handleTransNamedImport(transNamedImport, state);
		}
	}
};

const getCallExpressionName = (callExpression: CallExpression) => {
	const expr = callExpression.getExpression();

	if (Node.isIdentifier(expr)) {
		return expr.getText();
	} else if (Node.isPropertyAccessExpression(expr)) {
		return expr.getNameNode().getText();
	}

	return null;
};

const handleSourceFile = (sourceFile: SourceFile, state: State) => {
	sourceFile
		.getImportDeclarations()
		.forEach((importDeclaration) =>
			handleImportDeclaration(importDeclaration, state),
		);

	// handle t and language callExpressions
	sourceFile
		.getDescendantsOfKind(SyntaxKind.CallExpression)
		.forEach((callExpression) => {
			const name = getCallExpressionName(callExpression);

			if (name === null || !isTranslationFunctionName(name)) {
				return;
			}

			handleCallExpression(callExpression, name, state);
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

const handleLocaleFile = (sourceFile: SourceFile, state: State) => {
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

		for (const keyBeginning of state.keyBeginnings) {
			if (name.startsWith(keyBeginning)) {
				return;
			}
		}

		if (state.translations.has(name)) {
			return;
		}

		propertyAssignment.remove();
	});
};

type State = {
	translations: Set<string>;
	keyBeginnings: Set<string>;
	translationsCollected: boolean;
};

export const repomod: Repomod<Dependencies, State> = {
	includePatterns: ['**/*.{js,jsx,ts,tsx,cjs,mjs,json}'],
	excludePatterns: ['**/node_modules/**'],
	initializeState: async (_, previousState) => {
		return (
			previousState ?? {
				translations: new Set(),
				keyBeginnings: new Set(),
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

		if (!state.translationsCollected) {
			const { tsmorph } = api.getDependencies();

			handleSourceFile(buildSourceFile(tsmorph, data, path), state);
		}

		if (
			state.translationsCollected &&
			(state.translations.size !== 0 || state.keyBeginnings.size !== 0) &&
			path.includes('public/static/locales')
		) {
			const sourceFile = buildSourceFile(tsmorph, `(${data})`, path);
			handleLocaleFile(sourceFile, state);
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
