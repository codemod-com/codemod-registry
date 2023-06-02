import {
	BindingElement,
	FunctionDeclaration,
	ImportClause,
	NamedImports,
	NamespaceImport,
} from 'ts-morph';
import { ImportSpecifier } from 'ts-morph';
import {
	EmitHint,
	JsxSelfClosingElement,
	SyntaxKind,
	VariableDeclaration,
	VariableStatement,
} from 'ts-morph';
import {
	Identifier,
	ImportDeclaration,
	JsxElement,
	Node,
	SourceFile,
} from 'ts-morph';

type HTMLTagName = 'title' | 'meta' | 'link';
type HTMLAttributes = Record<string, string>;
export type ParsedMetadataTag = {
	HTMLTagName: HTMLTagName;
	HTMLAttributes: HTMLAttributes;
};

type Definition =
	| VariableDeclaration
	| FunctionDeclaration
	| ImportClause
	| ImportSpecifier
	| NamespaceImport
	| BindingElement;

const openGraphTags = [
	'og:type',
	'og:determiner',
	'og:title',
	'og:description',
	'og:url',
	'og:site_name',
	'og:locale',
	'og:country_name',
	'og:ttl',
];

// @TODO multi tags
// @TODO typedOpenGraph

const twitterTags = [
	'twitter:card',
	'twitter:site',
	'twitter:site:id',
	'twitter:creator',
	'twitter:creator:id',
	'twitter:title',
	'twitter:description',
];

// @TODO card=app
// @TODO card=player

// @TODO appLinks

const alternatesLinks = ['canonical', 'alternate'];

const basicTags = [
	'title',
	'description',
	'application-name',
	'author',
	'manifest',
	'generator',
	'keywords',
	'referrer',
	'theme-color',
	'color-scheme',
	'viewport',
	'creator',
	'publisher',
	'robots',
	'abstract',
	'archives',
	'assets',
	'bookmarks',
	'category',
	'classification',
];

const iTunesMeta = ['apple-itunes-app'];
const formatDetectionTags = ['format-detection'];
// @TODO AppleWebAppMeta
const verificationTags = [
	'google-site-verification',
	'y_key',
	'yandex-verification',
];
const iconTags = ['icon', 'apple-touch-icon', 'shortcut icon'];

const knownNames = [
	...openGraphTags,
	...twitterTags,
	...alternatesLinks,
	...basicTags,
	...iTunesMeta,
	...formatDetectionTags,
	...verificationTags,
	...iconTags,
];

export const camelize = (str: string) =>
	str.replace(/[-_]([a-z])/g, function (g) {
		return (g[1] ?? '').toUpperCase();
	});

const getTagPropertyName = (
	HTMLTagName: HTMLTagName,
	HTMLAttributes: HTMLAttributes,
) => {
	if (HTMLTagName === 'title') {
		return HTMLTagName;
	}

	if (HTMLTagName === 'meta') {
		return (
			(HTMLAttributes.name ?? HTMLAttributes.property)?.replace(
				/\"/g,
				'',
			) ?? null
		);
	}

	if (HTMLTagName === 'link') {
		return HTMLAttributes.rel?.replace(/\"/g, '') ?? null;
	}

	return null;
};

export const buildContainer = <T>(initialValue: T) => {
	let currentValue: T = initialValue;

	const get = (): T => {
		return currentValue;
	};

	const set = (callback: (previousValue: T) => T): void => {
		currentValue = callback(currentValue);
	};

	return {
		get,
		set,
	};
};

type Container<T> = ReturnType<typeof buildContainer<T>>;

const isDefinedOnTheTopLevel = (
	identifier: Identifier,
	topLevelVariablesContainer: Container<Definition[]>,
) => {
	const definitions = identifier.getDefinitionNodes() as Definition[];
	const topLevelDefinitions = topLevelVariablesContainer.get();
	const parent = identifier.getParent();
	const identifierChildIndex = identifier.getChildIndex();

	// if identifier is within property access expression "obj.a.b", check only for its root "obj"
	if (
		(Node.isPropertyAccessExpression(parent) ||
			Node.isElementAccessExpression(parent)) &&
		identifierChildIndex !== 0
	) {
		return true;
	}

	// @TODO
	if (identifier.getText() === 'process') {
		return true;
	}

	if (definitions.length === 0) {
		return false;
	}

	return definitions.every((definition) =>
		topLevelDefinitions.includes(definition),
	);
};

const handleJsxSelfClosingElement = (
	jsxSelfClosingElement: JsxSelfClosingElement,
	metadataContainer: Container<Record<string, any>>,
	topLevelVariablesContainer: Container<Definition[]>,
) => {
	const tagName = jsxSelfClosingElement.getTagNameNode().getText();

	if (tagName !== 'link' && tagName !== 'meta') {
		return;
	}

	const attributes = jsxSelfClosingElement.getAttributes();
	const attributesObject: Record<string, string> = {};

	let shouldReplaceTag = true;
	attributes.forEach((attribute) => {
		if (!shouldReplaceTag) {
			return;
		}

		if (Node.isJsxAttribute(attribute)) {
			const name = attribute.getName();
			const initializer = attribute.getInitializer();
			if (Node.isStringLiteral(initializer)) {
				attributesObject[name] = initializer.getText();
			} else if (Node.isJsxExpression(initializer)) {
				const identifiers = initializer.getDescendantsOfKind(
					SyntaxKind.Identifier,
				);

				identifiers.forEach((identifier) => {
					const definedOnTopLevel = isDefinedOnTheTopLevel(
						identifier,
						topLevelVariablesContainer,
					);
					if (!definedOnTopLevel) {
						shouldReplaceTag = false;
					}
				});

				attributesObject[name] =
					initializer.getExpression()?.getText() ?? '';
			}
		}
	});

	const parsedTag = {
		HTMLTagName: tagName as HTMLTagName,
		HTMLAttributes: attributesObject,
	};

	const name = getTagPropertyName(
		parsedTag.HTMLTagName,
		parsedTag.HTMLAttributes,
	);

	if (name && knownNames.includes(name)) {
		const comment = `{/* ${
			shouldReplaceTag
				? 'this tag can be removed'
				: 'this tag cannot be removed, because it uses variables from inner scope'
		}*/}`;

		jsxSelfClosingElement.replaceWithText(
			`${comment} \n ${jsxSelfClosingElement.getText()}`,
		);

		if (!shouldReplaceTag) {
			return;
		}

		handleTag(parsedTag, metadataContainer);
	}
};

const handleHeadChildJsxElement = (
	jsxElement: JsxElement,
	metadataContainer: Container<Record<string, any>>,
	topLevelVariablesContainer: Container<Definition[]>,
) => {
	if (jsxElement.getOpeningElement().getTagNameNode().getText() !== 'title') {
		return;
	}

	const children = jsxElement.getJsxChildren();

	let text = '';
	let shouldReplaceTag = true;
	children.forEach((child) => {
		if (!shouldReplaceTag) {
			return;
		}

		if (Node.isJsxText(child)) {
			const t = child.getFullText();
			text += t;
		} else if (Node.isJsxExpression(child)) {
			const expression = child.getExpression();
			const identifiers = child.getDescendantsOfKind(
				SyntaxKind.Identifier,
			);

			identifiers.forEach((identifier) => {
				const definedOnTopLevel = isDefinedOnTheTopLevel(
					identifier,
					topLevelVariablesContainer,
				);
				if (!definedOnTopLevel) {
					shouldReplaceTag = false;
				}
			});

			if (Node.isTemplateExpression(expression)) {
				const t = expression.getFullText().replace(/\`/g, '');
				text += t;
				return;
			}

			const expressionText = expression?.getText() ?? null;

			if (expressionText === null) {
				return;
			}

			text += `\${${expressionText}}`;
		}
	});

	const parsedTag = {
		HTMLTagName: 'title' as const,
		HTMLAttributes: {
			children: `\`${text}\``,
		},
	};

	const name = getTagPropertyName(
		parsedTag.HTMLTagName,
		parsedTag.HTMLAttributes,
	);

	if (name && knownNames.includes(name)) {
		const comment = `{/* ${
			shouldReplaceTag
				? 'this tag can be removed'
				: 'this tag cannot be removed, because it uses variables from inner scope'
		}*/}`;

		jsxElement.replaceWithText(`${comment} \n ${jsxElement.getText()}`);

		if (!shouldReplaceTag) {
			return;
		}

		handleTag(parsedTag, metadataContainer);
	}
};

const handleHeadJsxElement = (
	headJsxElement: JsxElement,
	metadataContainer: Container<Record<string, any>>,
	topLevelVariablesContainer: Container<Definition[]>,
) => {
	const jsxChildren = headJsxElement.getJsxChildren();

	jsxChildren.forEach((child) => {
		if (Node.isJsxElement(child)) {
			handleHeadChildJsxElement(
				child,
				metadataContainer,
				topLevelVariablesContainer,
			);
		} else if (Node.isJsxSelfClosingElement(child)) {
			handleJsxSelfClosingElement(
				child,
				metadataContainer,
				topLevelVariablesContainer,
			);
		}
	});
};

const handleHeadIdentifier = (
	headIdentifier: Identifier,
	metadataContainer: Container<Record<string, any>>,
	topLevelVariablesContainer: Container<Definition[]>,
) => {
	headIdentifier.findReferencesAsNodes().forEach((node) => {
		const parent = node.getParent();

		if (Node.isJsxOpeningElement(parent)) {
			const grandparent = parent.getParent();

			if (Node.isJsxElement(grandparent)) {
				handleHeadJsxElement(
					grandparent,
					metadataContainer,
					topLevelVariablesContainer,
				);
			}
		}
	});
};

const handleImportDeclaration = (
	importDeclaration: ImportDeclaration,
	metadataContainer: Container<Record<string, any>>,
	topLevelVariablesContainer: Container<Definition[]>,
) => {
	const moduleSpecifier = importDeclaration.getModuleSpecifier();

	if (moduleSpecifier.getLiteralText() !== 'next/head') {
		return;
	}

	const headIdentifier = importDeclaration.getDefaultImport() ?? null;

	if (headIdentifier === null) {
		return;
	}

	handleHeadIdentifier(
		headIdentifier,
		metadataContainer,
		topLevelVariablesContainer,
	);
};

export const handleTag = (
	{ HTMLTagName, HTMLAttributes }: ParsedMetadataTag,
	metadataContainer: Container<Record<string, any>>,
) => {
	const metadataObject = metadataContainer.get();
	const name = getTagPropertyName(HTMLTagName, HTMLAttributes);

	if (name === null) {
		return;
	}

	if (HTMLTagName === 'title') {
		metadataObject[HTMLTagName] = HTMLAttributes.children ?? '';
	}

	if (HTMLTagName === 'meta') {
		const content = HTMLAttributes.content;

		if (name === 'author') {
			if (!metadataObject.authors) {
				metadataObject.authors = [];
			}

			metadataObject['authors'].push({ name: content });
			return;
		}

		if (name === 'theme-color') {
			const { content, media } = HTMLAttributes;

			if (!metadataObject.themeColor) {
				metadataObject.themeColor = [];
			}

			metadataObject.themeColor.push({
				media,
				color: content,
			});

			return;
		}

		if (name === 'googlebot') {
			return;
		}

		if (name.startsWith('og:')) {
			const n = camelize(name.replace('og:', ''));

			if (!metadataObject.openGraph) {
				metadataObject.openGraph = {};
			}

			if (name.startsWith('og:image')) {
				// @TODO
				return;
			}

			metadataObject.openGraph[n] = content;
			return;
		}

		if (name.startsWith('twitter:')) {
			const n = camelize(name.replace('twitter:', ''));

			if (!metadataObject.twitter) {
				metadataObject.twitter = {};
			}

			if (name === 'twitter:site:id') {
				metadataObject.twitter.siteId = content;
				return;
			}

			if (name === 'twitter:creator:id') {
				metadataObject.twitter.creatorId = content;
				return;
			}

			metadataObject.twitter[n] = content;
			return;
		}

		const verification: Record<string, string> = {
			'google-site-verification': 'google',
			'yandex-verification': 'yandex',
			y_key: 'yahoo',
		};

		if (Object.keys(verification).includes(name)) {
			if (!metadataObject.verification) {
				metadataObject.verification = {};
			}

			const propName = verification[name];

			if (!propName) {
				return;
			}

			metadataObject.verification[propName] = content;
			return;
		}

		if (name === 'format-detection') {
			return;
		}

		const propertyName = camelize(name);
		metadataObject[propertyName] = content;
	}

	if (HTMLTagName === 'link') {
		const content = HTMLAttributes.href;

		if (name === 'author') {
			if (metadataObject.authors.length === 0) {
				return;
			}

			metadataObject.authors[metadataObject.authors.length - 1].url =
				content;

			return;
		}

		if (['archives', 'assets', 'bookmarks'].includes(name)) {
			if (!metadataObject[name]) {
				metadataObject[name] = [];
			}

			metadataObject[name].push(content);

			return;
		}

		if (['canonical', 'alternate'].includes(name)) {
			if (!metadataObject.alternates) {
				metadataObject.alternates = {};
			}

			if (name === 'canonical') {
				metadataObject.alternates[name] = content;
			}

			const { hreflang, media, type, href } = HTMLAttributes;

			if (hreflang) {
				if (!metadataObject.alternates.languages) {
					metadataObject.alternates.languages = {};
				}

				metadataObject.alternates.languages[hreflang] = href;
			}

			if (media) {
				if (!metadataObject.alternates.media) {
					metadataObject.alternates.media = {};
				}

				metadataObject.alternates.media[media] = href;
			}

			if (type) {
				if (!metadataObject.alternates.types) {
					metadataObject.alternates.types = {};
				}

				metadataObject.alternates.types[type] = href;
			}

			return;
		}

		const icons: Record<string, string> = {
			'shortcut icon': 'shortcut',
			icon: 'icon',
			'apple-touch-icon': 'apple',
		};

		if (Object.keys(icons).includes(name)) {
			const n = icons[name];

			if (!n) {
				return;
			}

			if (!metadataObject.icons) {
				metadataObject.icons = {};
			}

			metadataObject.icons[n] = content;
			return;
		}

		if (name.startsWith('al:')) {
			return;
		}

		const propertyName = camelize(name);
		metadataObject[propertyName] = content;
	}

	metadataContainer.set(() => metadataObject);
};

const buildMetadataObjectStr = (metadataObject: Record<string, any>) => {
	let str = '{';
	Object.keys(metadataObject).forEach((key) => {
		const val = metadataObject[key];
		let value = '';
		if (typeof val === 'string') {
			value = val;
		} else if (Array.isArray(val)) {
			value = `[${val
				.map((item) =>
					typeof item === 'string'
						? item
						: buildMetadataObjectStr(item),
				)
				.join()}]`;
		} else if (typeof val === 'object' && val !== null) {
			value = buildMetadataObjectStr(val);
		}

		str += `\n ${key}: ${value},`;
	});

	str += '}';

	return str;
};

const buildMetadataStatement = (metadataObject: Record<string, string>) => {
	return `export const metadata: Metadata = ${buildMetadataObjectStr(
		metadataObject,
	)}`;
};

const collectVariableDeclaration = (
	variableStatement: VariableStatement,
	topLevelVariablesContainer: Container<Definition[]>,
) => {
	const declarations = variableStatement.getDeclarations();

	declarations.forEach((declaration) => {
		topLevelVariablesContainer.set((prev) => [...prev, declaration]);
	});
};

const collectImportDeclaration = (
	importDeclaration: ImportDeclaration,
	topLevelVariablesContainer: Container<Definition[]>,
) => {
	const namedImports = importDeclaration.getNamedImports();

	namedImports.forEach((namedImport) => {
		topLevelVariablesContainer.set((prev) => [...prev, namedImport]);
	});

	const namespaceImport = importDeclaration.getNamespaceImport()?.getParent();

	if (namespaceImport) {
		topLevelVariablesContainer.set((prev) => [
			...prev,
			namespaceImport as NamespaceImport,
		]);
	}

	const defaultImport = importDeclaration.getDefaultImport()?.getParent();

	if (defaultImport) {
		topLevelVariablesContainer.set((prev) => [
			...prev,
			defaultImport as ImportClause,
		]);
	}
};

const collectTopLevelDefinitions = (
	sourceFile: SourceFile,
	topLevelVariablesContainer: Container<Definition[]>,
) => {
	const importDeclarations = sourceFile.getImportDeclarations();
	const variableStatements = sourceFile.getVariableStatements();

	variableStatements.forEach((variableStatement) => {
		collectVariableDeclaration(
			variableStatement,
			topLevelVariablesContainer,
		);
	});

	importDeclarations.forEach((importDeclaration) => {
		collectImportDeclaration(importDeclaration, topLevelVariablesContainer);
	});
};
export const handleSourceFile = (
	sourceFile: SourceFile,
): string | undefined => {
	const metadataContainer = buildContainer<Record<string, any>>({});
	const topLevelVariablesContainer = buildContainer<Definition[]>([]);
	const importDeclarations = sourceFile.getImportDeclarations();

	collectTopLevelDefinitions(sourceFile, topLevelVariablesContainer);

	importDeclarations.forEach((importDeclaration) =>
		handleImportDeclaration(
			importDeclaration,
			metadataContainer,
			topLevelVariablesContainer,
		),
	);

	const metadataObject = metadataContainer.get();
	const hasChanges = Object.keys(metadataObject).length !== 0;
	if (!hasChanges) {
		return undefined;
	}

	const declaration = [...importDeclarations].pop();

	const pos = declaration?.wasForgotten()
		? 0
		: (declaration?.getChildIndex() ?? 0) + 1;

	sourceFile.insertStatements(pos, buildMetadataStatement(metadataObject));
	sourceFile.insertStatements(0, 'import { Metadata } from "next";');
	return sourceFile.print({ emitHint: EmitHint.SourceFile });
};
