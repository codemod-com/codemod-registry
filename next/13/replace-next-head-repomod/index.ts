import tsmorph, {
	Identifier,
	JsxOpeningElement,
	JsxSelfClosingElement,
	ModuleKind,
	Node,
	SourceFile,
	BindingElement,
	FunctionDeclaration,
	ImportClause,
	NamespaceImport,
	ImportSpecifier,
	SyntaxKind,
	VariableDeclaration,
	VariableStatement,
	ImportDeclaration,
	JsxElement,
} from 'ts-morph';

import type {
	Repomod,
	UnifiedFileSystem,
} from '@intuita-inc/repomod-engine-api';
import type { fromMarkdown } from 'mdast-util-from-markdown';
import type { visit } from 'unist-util-visit';
import { posix } from 'node:path';
/**
 * Copied from "../replace-next-head"
 */

type HTMLTagName = 'title' | 'meta' | 'link';
type HTMLAttributes = Record<string, string>;
type ParsedMetadataTag = {
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

const openGraphWebsiteTags = [
	'og:type',
	'og:determiner',
	'og:title',
	'og:description',
	'og:url',
	'og:site_name',
	'og:locale',
	'og:locale:alternate',
	'og:country_name',
	'og:ttl',
	'og:image',
	'og:image:url',
	'og:image:width',
	'og:image:height',
	'og:image:alt',
	'og:audio',
	'og:audio:secure_url',
	'og:audio:type',
	'og:video',
	'og:video:secure_url',
	'og:video:type',
	'og:video:width',
	'og:video:height',
];

const openGraphArticleTags = [
	'article:published_time',
	'article:modified_time',
	'article:expiration_time',
	'article:author',
	'article:section',
	'article:tag',
];

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

const iconTags = ['icon', 'apple-touch-icon', 'shortcut icon', 'mask-icon'];

const otherMetaTags = ['msapplication-TileColor', 'msapplication-config'];

const knownNames = [
	...openGraphWebsiteTags,
	...openGraphArticleTags,
	...twitterTags,
	...alternatesLinks,
	...basicTags,
	...iTunesMeta,
	...formatDetectionTags,
	...verificationTags,
	...iconTags,
	...otherMetaTags,
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
	//  alternative
	//  return definition.getFirstAncestorByKind(SyntaxKind.Block) === undefined;
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
	settingsContainer: Container<Record<string, any>>,
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
			const name = attribute.getNameNode().getText();
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

					const definedInComponentProps =
						isIdentifierDefinedInPageProps(identifier);

					if (definedInComponentProps) {
						settingsContainer.set((prev) => ({
							...prev,
							isDynamicMetadata: true,
						}));
					}

					if (!definedOnTopLevel && !definedInComponentProps) {
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
	settingsContainer: Container<Record<string, any>>,
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

				const definedInComponentProps =
					isIdentifierDefinedInPageProps(identifier);

				if (definedInComponentProps) {
					settingsContainer.set((prev) => ({
						...prev,
						isDynamicMetadata: true,
					}));
				}

				if (!definedOnTopLevel && !definedInComponentProps) {
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
	settingsContainer: Container<Record<string, any>>,
) => {
	const jsxChildren = headJsxElement.getJsxChildren();

	jsxChildren.forEach((child) => {
		if (Node.isJsxElement(child)) {
			handleHeadChildJsxElement(
				child,
				metadataContainer,
				topLevelVariablesContainer,
				settingsContainer,
			);
		} else if (Node.isJsxSelfClosingElement(child)) {
			handleJsxSelfClosingElement(
				child,
				metadataContainer,
				topLevelVariablesContainer,
				settingsContainer,
			);
		}
	});
};

const handleHeadIdentifier = (
	headIdentifier: Identifier,
	metadataContainer: Container<Record<string, any>>,
	topLevelVariablesContainer: Container<Definition[]>,
	settingsContainer: Container<Record<string, any>>,
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
					settingsContainer,
				);
			}
		}
	});
};

export const handleImportDeclaration = (
	importDeclaration: ImportDeclaration,
	metadataContainer: Container<Record<string, any>>,
	topLevelVariablesContainer: Container<Definition[]>,
	settingsContainer: Container<Record<string, any>>,
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
		settingsContainer,
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

		if (otherMetaTags.includes(name)) {
			if (!metadataObject.other) {
				metadataObject.other = {};
			}

			metadataObject.other[name] = content;
			return;
		}

		if (name.startsWith('article')) {
			const { content } = HTMLAttributes;

			if (!metadataObject.openGraph) {
				metadataObject.openGraph = {};
			}

			if (name === 'article:author') {
				if (!metadataObject.openGraph.authors) {
					metadataObject.openGraph.authors = [];
				}

				metadataObject.openGraph.authors.push(content);

				return;
			}

			if (name === 'article:tag') {
				if (!metadataObject.openGraph.tags) {
					metadataObject.openGraph.tags = [];
				}

				metadataObject.openGraph.tags.push(content);

				return;
			}

			metadataObject.openGraph[camelize(name.replace('article:', ''))] =
				content;

			return;
		}

		if (name === 'author') {
			if (!metadataObject.authors) {
				metadataObject.authors = [];
			}

			metadataObject['authors'].push({ name: content });
			return;
		}

		if (name === 'theme-color') {
			const { content, media } = HTMLAttributes;

			if (!content && !media) {
				return;
			}

			if (!metadataObject.themeColor) {
				metadataObject.themeColor = [];
			}

			const themeColorObj = {
				...(media && { media }),
				...(content && { color: content }),
			};

			metadataObject.themeColor.push(themeColorObj);

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

			// image structured property
			if (name.startsWith('og:image')) {
				const { content } = HTMLAttributes;

				if (!metadataObject.openGraph.images) {
					metadataObject.openGraph.images = [];
				}

				if (name === 'og:image:url' || name === 'og:image') {
					metadataObject.openGraph.images.push({
						url: content,
					});
				} else {
					const image = metadataObject.openGraph.images.at(-1);
					const propName = name.replace('og:image:', '');

					image[propName] = content;
				}

				return;
			}

			if (name.startsWith('og:audio')) {
				const { content } = HTMLAttributes;

				if (!metadataObject.openGraph.audio) {
					metadataObject.openGraph.audio = [];
				}

				if (name === 'og:audio') {
					metadataObject.openGraph.audio.push({
						url: content,
					});
				} else {
					const audio = metadataObject.openGraph.audio.at(-1);
					const propName = name.replace('og:audio:', '');

					audio[camelize(propName)] = content;
				}

				return;
			}

			if (name.startsWith('og:video')) {
				const { content } = HTMLAttributes;

				if (!metadataObject.openGraph.videos) {
					metadataObject.openGraph.videos = [];
				}

				if (name === 'og:video') {
					metadataObject.openGraph.videos.push({
						url: content,
					});
				} else {
					const video = metadataObject.openGraph.videos.at(-1);
					const propName = name.replace('og:video:', '');

					video[camelize(propName)] = content;
				}

				return;
			}

			if (name === 'og:locale:alternate') {
				const { content } = HTMLAttributes;

				if (!metadataObject.openGraph.alternateLocale) {
					metadataObject.openGraph.alternateLocale = [];
				}

				metadataObject.openGraph.alternateLocale.push(content);
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

		const otherIcons = ['mask-icon'];

		const icons: Record<string, string> = {
			'shortcut icon': 'shortcut',
			icon: 'icon',
			'apple-touch-icon': 'apple',
			'mask-icon': 'other',
			...Object.fromEntries(
				otherIcons.map((otherIcon) => [otherIcon, 'other']),
			),
		};

		if (Object.keys(icons).includes(name)) {
			const iconTypeName = icons[name];
			const { sizes, type, href, rel } = HTMLAttributes;

			if (!iconTypeName) {
				return;
			}

			if (!metadataObject.icons) {
				metadataObject.icons = {};
			}

			if (!metadataObject.icons[iconTypeName]) {
				metadataObject.icons[iconTypeName] = [];
			}

			const shouldIncludeRel = otherIcons.includes(name);

			const iconMetadataObject = {
				...(sizes && { sizes }),
				...(type && { type }),
				...(href && { url: href }),
				...(shouldIncludeRel && rel && { rel }),
			};

			metadataObject.icons[iconTypeName].push(iconMetadataObject);
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

const isValidIdentifier = (identifierName: string): boolean => {
	if (identifierName.length === 0) {
		return false;
	}

	if (!/[a-zA-Z_]/.test(identifierName.charAt(0))) {
		return false;
	}

	const validChars = /^[a-zA-Z0-9_]*$/;
	return validChars.test(identifierName);
};

const isDoubleQuotified = (str: string) =>
	str.startsWith('"') && str.endsWith('"');

// @TODO refactor this
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

		const keyIsValidIdentifier = isValidIdentifier(key);
		const keyDoubleQuotified = isDoubleQuotified(key);

		str += `\n ${
			!keyIsValidIdentifier && !keyDoubleQuotified ? `"${key}"` : key
		}: ${value},`;
	});

	str += '}';

	return str;
};

const buildMetadataStatement = (metadataObject: Record<string, unknown>) => {
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

	if (Node.isNamespaceImport(namespaceImport)) {
		topLevelVariablesContainer.set((prev) => [...prev, namespaceImport]);
	}

	const defaultImport = importDeclaration.getDefaultImport()?.getParent();

	if (Node.isImportClause(defaultImport)) {
		topLevelVariablesContainer.set((prev) => [...prev, defaultImport]);
	}
};

export const collectTopLevelDefinitions = (
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

const isIdentifierDefinedInPageProps = (identifier: Identifier): boolean => {
	const definitions = identifier.getDefinitionNodes();

	return (
		definitions.length !== 0 &&
		definitions.every((d) => {
			const param = d.getFirstAncestorByKind(SyntaxKind.Parameter);
			const parent = param?.getParent();

			return (
				param &&
				Node.isFunctionDeclaration(parent) &&
				parent.isDefaultExport()
			);
		})
	);
};

// const getPageComponentFunctionDeclaration = (sourceFile: SourceFile) => {
// 	return sourceFile.getFunctions().find((f) => f.isDefaultExport()) ?? null;
// };

// const getGetStaticPropsFunctionDeclarationOrIdentifier = (
// 	sourceFile: SourceFile,
// 	hookNames: string[],
// ): FunctionDeclaration | Identifier | null => {
// 	let res: FunctionDeclaration | Identifier | null = null;

// 	sourceFile.forEachChild((child) => {
// 		if (
// 			Node.isFunctionDeclaration(child) &&
// 			hookNames.includes(child.getName() ?? '')
// 		) {
// 			res = child;
// 		}

// 		if (Node.isVariableStatement(child) && child.hasExportKeyword()) {
// 			const declaration = child
// 				.getFirstChildByKind(SyntaxKind.VariableDeclarationList)
// 				?.getFirstChildByKind(SyntaxKind.VariableDeclaration);

// 			if (
// 				declaration?.getInitializer()?.getKind() ===
// 				SyntaxKind.ArrowFunction
// 			) {
// 				const nameNode = declaration.getNameNode();
// 				if (
// 					Node.isIdentifier(nameNode) &&
// 					hookNames.includes(nameNode.getText())
// 				) {
// 					res = nameNode;
// 				}
// 			}
// 		}
// 	});

// 	return res;
// };

// const insertGenerateMetadataFunctionDeclaration = (
// 	sourceFile: SourceFile,
// 	metadataObject: Record<string, any>,
// ) => {
// 	const pageComponentFunctionDeclaration =
// 		getPageComponentFunctionDeclaration(sourceFile);

// 	if (pageComponentFunctionDeclaration === null) {
// 		return;
// 	}

// 	const getStaticPropsFunctionDeclaration =
// 		getGetStaticPropsFunctionDeclarationOrIdentifier(sourceFile, [
// 			'getStaticProps',
// 			'_getStaticProps',
// 		]);

// 	const getServerSidePropsFunctionDeclaration =
// 		getGetStaticPropsFunctionDeclarationOrIdentifier(sourceFile, [
// 			'getServerSideProps',
// 			'_getServerSideProps',
// 		]);

// 	const hook =
// 		getServerSidePropsFunctionDeclaration ??
// 		getStaticPropsFunctionDeclaration ??
// 		null;
// 	const isStatic = getStaticPropsFunctionDeclaration !== null;

// 	if (hook === null) {
// 		return;
// 	}

// 	// rename to avoid next.js warnings
// 	hook.rename(isStatic ? '_getStaticProps' : '_getServerSideProps');

// 	const propsParameter =
// 		pageComponentFunctionDeclaration.getParameters()[0] ?? null;

// 	if (propsParameter === null) {
// 		return;
// 	}

// 	const propsParameterIsObjectBindingPattern = Node.isObjectBindingPattern(
// 		propsParameter.getNameNode(),
// 	);

// 	sourceFile.addStatements(
// 		`
// 			export async function generateMetadata(
// 				{ params }: { params: Params },
// 				parentMetadata: ResolvingMetadata
// 			): Promise<Metadata> {
// 					const { props }  = await  ${
// 						isStatic ? '_getStaticProps' : '_getServerSideProps'
// 					}({ params });
// 					const awaitedParentMetadata = await parentMetadata;

// 					${
// 						propsParameterIsObjectBindingPattern
// 							? `const ${propsParameter.getText()} = props;`
// 							: ''
// 					}

// 					const pageMetadata = ${buildMetadataObjectStr(metadataObject)};

// 					return {
// 						...awaitedParentMetadata,
// 						...pageMetadata
// 					}
// 					}	`,
// 	);
// };

type Root = ReturnType<typeof fromMarkdown>;

// eslint-disable-next-line @typescript-eslint/ban-types
type Dependencies = Readonly<{
	tsmorph: typeof tsmorph;
	parseMdx?: (data: string) => Root;
	stringifyMdx?: (tree: Root) => string;
	visitMdxAst?: typeof visit;
	unifiedFileSystem: UnifiedFileSystem;
}>;

type ComponentTreeNode = {
	path: string;
	components: Record<string, ComponentTreeNode>;
	props: Record<string, string>;
	metadata: Record<string, unknown>;
};

let project: tsmorph.Project | null = null;

const defaultCompilerOptions = {
	allowJs: true,
	module: ModuleKind.ESNext,
	traceResolution: true,
};

export const buildComponentMetadata = (
	sourceFile: SourceFile,
): Record<string, unknown> => {
	const metadataContainer = buildContainer<Record<string, any>>({});
	const topLevelVariablesContainer = buildContainer<Definition[]>([]);
	const importDeclarations = sourceFile.getImportDeclarations();
	const settingsContainer = buildContainer<Record<string, any>>({});

	collectTopLevelDefinitions(sourceFile, topLevelVariablesContainer);

	importDeclarations.forEach((importDeclaration) =>
		handleImportDeclaration(
			importDeclaration,
			metadataContainer,
			topLevelVariablesContainer,
			settingsContainer,
		),
	);

	return metadataContainer.get();
};

const initTsMorphProject = async (
	tsmorph: Dependencies['tsmorph'],
	unifiedFileSystem: Dependencies['unifiedFileSystem'],
	rootPath: string,
	compilerOptions: tsmorph.CompilerOptions = defaultCompilerOptions,
) => {
	project = new tsmorph.Project({
		useInMemoryFileSystem: true,
		skipFileDependencyResolution: true,
		// @TODO pass resolved config
		compilerOptions,
	});

	const allFilePaths = await unifiedFileSystem.getFilePaths(
		rootPath,
		['**/*.{jsx,tsx}'],
		[],
	);
	for (const path of allFilePaths) {
		const content = await unifiedFileSystem.readFile(path);
		project.createSourceFile(path, content);
	}
};

const collectedImportedIdentifiers = (sourceFile: SourceFile) => {
	const result = new Map<string, Identifier[]>();

	const importDeclarations = sourceFile.getImportDeclarations();

	importDeclarations.forEach((importDeclaration) => {
		const moduleSpecifierValue =
			importDeclaration.getModuleSpecifierValue();
		const importSpecifiers = importDeclaration.getNamedImports();

		if (!result.has(moduleSpecifierValue)) {
			result.set(moduleSpecifierValue, []);
		}

		const identifiers = result.get(moduleSpecifierValue) ?? [];

		importSpecifiers.forEach((importSpecifier) => {
			identifiers.push(importSpecifier.getNameNode());
		});

		const defaultImport = importDeclaration.getDefaultImport() ?? null;

		if (defaultImport !== null) {
			identifiers.push(defaultImport);
		}
	});

	return result;
};

const buildComponentTreeNode = async (
	tsmorph: Dependencies['tsmorph'],
	containingPath: string,
	treeNode: ComponentTreeNode,
) => {
	if (project === null) {
		return treeNode;
	}

	treeNode.path = containingPath;
	treeNode.components = {};

	const sourceFile = project.getSourceFile(containingPath) ?? null;

	if (sourceFile === null) {
		return treeNode;
	}

	treeNode.metadata = buildComponentMetadata(sourceFile);

	const importIdentifiersByImportPath =
		collectedImportedIdentifiers(sourceFile);

	const paths = importIdentifiersByImportPath.keys();

	for (const path of paths) {
		const resolvedPath = tsmorph.ts.resolveModuleName(
			path,
			containingPath,
			project.getCompilerOptions(),
			project.getModuleResolutionHost(),
			undefined,
			undefined,
			ModuleKind.ESNext,
		);

		const identifiers = importIdentifiersByImportPath.get(path) ?? [];
		identifiers.forEach((identifier) => {
			const refs = identifier.findReferencesAsNodes();

			let jsxElement:
				| JsxSelfClosingElement
				| JsxOpeningElement
				| undefined;

			refs.forEach((ref) => {
				const parent = ref.getParent();

				if (
					Node.isJsxSelfClosingElement(parent) ||
					Node.isJsxOpeningElement(parent)
				) {
					jsxElement = parent;
				}
			});

			if (jsxElement !== undefined) {
				const resolvedFileName =
					resolvedPath.resolvedModule?.resolvedFileName ?? '';

				treeNode.components[resolvedFileName] = {
					path,
					props: {},
					metadata: {},
					components: {},
				};
				const attributes = jsxElement.getAttributes();
				attributes.forEach((attribute) => {
					if (Node.isJsxAttribute(attribute)) {
						const name = attribute.getNameNode().getText();
						const initializer = attribute.getInitializer();

						if (Node.isStringLiteral(initializer)) {
							treeNode.components[resolvedFileName]!.props[name] =
								initializer.getText();
						} else if (Node.isJsxExpression(initializer)) {
							treeNode.components[resolvedFileName]!.props[name] =
								initializer.getExpression()?.getText() ?? '';
						}
					}
				});
			}
		});
	}

	return treeNode;
};

const buildComponentTree = async (
	tsmorph: Dependencies['tsmorph'],
	containingPath: string,
	treeNode: ComponentTreeNode,
) => {
	const node = await buildComponentTreeNode(
		tsmorph,
		containingPath,
		treeNode,
	);

	const componentPaths = Object.keys(node.components);

	for (const path of componentPaths) {
		const componentNode = node.components[path];
		if (!componentNode) {
			return;
		}

		await buildComponentTree(tsmorph, path, componentNode);
	}

	return node;
};

const mergeMetadata = (
	treeNode: ComponentTreeNode,
): Record<string, unknown> => {
	const currentComponentMetadata = treeNode.metadata;

	return Object.entries(treeNode.components)
		.map((arr) => mergeMetadata(arr[1]))
		.reduce((mergedMetadata, childMetadata) => {
			return { ...mergedMetadata, ...childMetadata };
		}, currentComponentMetadata);
};

const insertMetadata = (
	sourceFile: SourceFile,
	metadataObject: Record<string, unknown>,
) => {
	const hasChanges = Object.keys(metadataObject).length !== 0;
	if (!hasChanges) {
		return undefined;
	}

	const importDeclarations = sourceFile.getImportDeclarations();

	const declaration = [...importDeclarations].pop();

	const pos = declaration?.wasForgotten()
		? 0
		: (declaration?.getChildIndex() ?? 0) + 1;

	sourceFile.insertStatements(pos, buildMetadataStatement(metadataObject));

	const importAlreadyExists = sourceFile
		.getImportDeclarations()
		.find((declaration) => {
			const specifier =
				declaration
					.getImportClause()
					?.getNamedImports()
					.find(
						(imp) => imp.getNameNode().getText() === 'Metadata',
					) ?? null;
			return (
				specifier !== null &&
				declaration.getModuleSpecifier().getText() === '"next"'
			);
		});

	if (!importAlreadyExists) {
		sourceFile.insertStatements(0, `import { Metadata } from "next";`);
	}
};

export const repomod: Repomod<Dependencies> = {
	includePatterns: ['**/pages/**/*.{jsx,tsx}'],
	excludePatterns: ['**/node_modules/**', '**/pages/api/**'],
	handleFile: async (api, path, options) => {
		const { unifiedFileSystem, tsmorph } = api.getDependencies();
		const parsedPath = posix.parse(path);
		const projectDir = parsedPath.dir
			.split(posix.sep)
			.slice(0, -1)
			.join(posix.sep);

		if (project === null) {
			await initTsMorphProject(tsmorph, unifiedFileSystem, projectDir);
		}

		const componentTree: ComponentTreeNode = {
			path,
			components: {},
			props: {},
			metadata: {},
		};

		await buildComponentTree(tsmorph, path, componentTree);
		const mergedMetadata = mergeMetadata(componentTree);
		return [
			{
				kind: 'upsertFile',
				path,
				options: {
					...options,
					metadata: JSON.stringify(mergedMetadata),
				},
			},
		];
	},
	handleData: async (api, path, data, options) => {
		const { tsmorph } = api.getDependencies();

		const project = new tsmorph.Project({
			useInMemoryFileSystem: true,
			skipFileDependencyResolution: true,
			compilerOptions: {
				allowJs: true,
			},
		});

		const sourceFile = project.createSourceFile(path, data);

		try {
			const metadata = JSON.parse(options.metadata ?? '');

			insertMetadata(sourceFile, metadata);

			return {
				kind: 'upsertData',
				path,
				data: sourceFile.print(),
			};
		} catch (e) {
			console.error(e);
		}

		return {
			kind: 'noop',
		};
	},
};
