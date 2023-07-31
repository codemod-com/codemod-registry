import tsmorph, {
	Identifier,
	JsxOpeningElement,
	JsxSelfClosingElement,
	ModuleKind,
	Node,
	SourceFile,
	SyntaxKind,
	ImportDeclaration,
	JsxElement,
	ImportDeclarationStructure,
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

type Dependency = {
	kind: SyntaxKind;
	text: string;
	structure: ImportDeclarationStructure | null;
};

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

const getStructure = (node: Node) => {
	if (Node.isImportDeclaration(node)) {
		return node.getStructure();
	}

	return null;
};

const getDependenciesForIdentifiers = (identifiers: Identifier[]) => {
	const dependencies: Record<string, Dependency> = {};

	identifiers.forEach((identifier) => {
		const parent = identifier.getParent();
		const identifierChildIndex = identifier.getChildIndex();

		if (
			(Node.isPropertyAccessExpression(parent) ||
				Node.isElementAccessExpression(parent)) &&
			identifierChildIndex !== 0
		) {
			return;
		}

		const definitions = identifier.getDefinitionNodes();

		const firstDefinition = definitions[0] ?? null;

		if (firstDefinition === null) {
			return;
		}

		const syntaxes = [
			SyntaxKind.Parameter,
			SyntaxKind.VariableStatement,
			SyntaxKind.ImportDeclaration,
			SyntaxKind.FunctionDeclaration,
		];

		let foundAncestor = null as Node | null;

		syntaxes.forEach((s) => {
			if (foundAncestor) {
				return;
			}

			const ancestor = firstDefinition.getFirstAncestorByKind(s) ?? null;

			if (ancestor !== null) {
				foundAncestor = ancestor;
			}
		});

		const identifierName = identifier.getText();

		if (foundAncestor === null) {
			return;
		}

		dependencies[identifierName] = {
			text: foundAncestor.getText(),
			structure: getStructure(foundAncestor),
			kind: foundAncestor.getKind(),
		};
	});

	return dependencies;
};

const handleJsxSelfClosingElement = (
	jsxSelfClosingElement: JsxSelfClosingElement,
	metadataContainer: Container<Record<string, any>>,
	settingsContainer: Container<Record<string, any>>,
) => {
	const tagName = jsxSelfClosingElement.getTagNameNode().getText();

	if (tagName !== 'link' && tagName !== 'meta') {
		return;
	}

	const attributes = jsxSelfClosingElement.getAttributes();
	const attributesObject: Record<string, string> = {};

	attributes.forEach((attribute) => {
		if (Node.isJsxAttribute(attribute)) {
			const name = attribute.getNameNode().getText();
			const initializer = attribute.getInitializer();
			if (Node.isStringLiteral(initializer)) {
				attributesObject[name] = initializer.getText();
			} else if (Node.isJsxExpression(initializer)) {
				const identifiers = initializer.getDescendantsOfKind(
					SyntaxKind.Identifier,
				);

				settingsContainer.set((prev) => ({
					...prev,
					dependencies: getDependenciesForIdentifiers(identifiers),
				}));

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
		handleTag(parsedTag, metadataContainer);
	}
};

const handleHeadChildJsxElement = (
	jsxElement: JsxElement,
	metadataContainer: Container<Record<string, any>>,
	settingsContainer: Container<Record<string, any>>,
) => {
	if (jsxElement.getOpeningElement().getTagNameNode().getText() !== 'title') {
		return;
	}

	const children = jsxElement.getJsxChildren();

	let text = '';
	children.forEach((child) => {
		if (Node.isJsxText(child)) {
			const t = child.getFullText();
			text += t;
		} else if (Node.isJsxExpression(child)) {
			const expression = child.getExpression();
			const identifiers = child.getDescendantsOfKind(
				SyntaxKind.Identifier,
			);

			settingsContainer.set((prev) => ({
				...prev,
				dependencies: getDependenciesForIdentifiers(identifiers),
			}));

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
		handleTag(parsedTag, metadataContainer);
	}
};

const handleHeadJsxElement = (
	headJsxElement: JsxElement,
	metadataContainer: Container<Record<string, any>>,
	settingsContainer: Container<Record<string, any>>,
) => {
	const jsxChildren = headJsxElement.getJsxChildren();

	jsxChildren.forEach((child) => {
		if (Node.isJsxElement(child)) {
			handleHeadChildJsxElement(
				child,
				metadataContainer,
				settingsContainer,
			);
		} else if (Node.isJsxSelfClosingElement(child)) {
			handleJsxSelfClosingElement(
				child,
				metadataContainer,
				settingsContainer,
			);
		}
	});
};

const handleHeadIdentifier = (
	headIdentifier: Identifier,
	metadataContainer: Container<Record<string, any>>,
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
					settingsContainer,
				);
			}
		}
	});
};

export const handleImportDeclaration = (
	importDeclaration: ImportDeclaration,
	metadataContainer: Container<Record<string, any>>,
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

	handleHeadIdentifier(headIdentifier, metadataContainer, settingsContainer);
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
	dependencies: Record<string, Dependency>;
};

let project: tsmorph.Project | null = null;

const defaultCompilerOptions = {
	allowJs: true,
	module: ModuleKind.ESNext,
	traceResolution: true,
};

export const buildComponentMetadata = (
	sourceFile: SourceFile,
): {
	metadata: Record<string, unknown>;
	dependencies: Record<string, Dependency>;
} => {
	const metadataContainer = buildContainer<Record<string, any>>({});
	const settingsContainer = buildContainer<Record<string, any>>({});

	const importDeclarations = sourceFile.getImportDeclarations();

	importDeclarations.forEach((importDeclaration) =>
		handleImportDeclaration(
			importDeclaration,
			metadataContainer,
			settingsContainer,
		),
	);

	return {
		metadata: metadataContainer.get(),
		dependencies: settingsContainer.get().dependencies,
	};
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
) => {
	const treeNode: ComponentTreeNode = {
		path: containingPath,
		components: {},
		metadata: {},
		dependencies: {},
		props: {},
	};

	if (project === null) {
		return treeNode;
	}

	const sourceFile = project.getSourceFile(containingPath) ?? null;

	if (sourceFile === null) {
		return treeNode;
	}

	const { metadata, dependencies } = buildComponentMetadata(sourceFile);

	treeNode.metadata = metadata;
	treeNode.dependencies = dependencies;

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

		const resolvedFileName =
			resolvedPath.resolvedModule?.resolvedFileName ?? null;

		if (resolvedFileName === null) {
			continue;
		}

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
				treeNode.components[resolvedFileName] = {
					path,
					props: {},
					metadata: {},
					components: {},
					dependencies: {},
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
) => {
	const node: ComponentTreeNode = await buildComponentTreeNode(
		tsmorph,
		containingPath,
	);

	const componentPaths = Object.keys(node.components);

	for (const path of componentPaths) {
		node.components[path] = await buildComponentTree(tsmorph, path);
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

const mergeDependencies = (
	treeNode: ComponentTreeNode,
): Record<string, unknown> => {
	const currentComponentDependencies = treeNode.dependencies;

	return Object.entries(treeNode.components)
		.map((arr) => mergeDependencies(arr[1]))
		.reduce((mergedDependencies, childDependencies) => {
			return { ...mergedDependencies, ...childDependencies };
		}, currentComponentDependencies);
};

const insertMetadata = (
	sourceFile: SourceFile,
	metadataObject: Record<string, unknown>,
) => {
	if (Object.keys(metadataObject).length === 0) {
		return undefined;
	}

	const positionAfterImports = getPositionAfterImports(sourceFile);

	sourceFile.insertStatements(
		positionAfterImports,
		buildMetadataStatement(metadataObject),
	);

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

const getPositionAfterImports = (sourceFile: SourceFile): number => {
	const lastImportDeclaration =
		sourceFile.getLastChildByKind(SyntaxKind.ImportDeclaration) ?? null;

	if (lastImportDeclaration === null) {
		return 0;
	}

	return lastImportDeclaration.getChildIndex() + 1;
};

const mergeOrCreateImports = (
	sourceFile: SourceFile,
	{ moduleSpecifier, namedImports }: ImportDeclarationStructure,
) => {
	const importDeclarations = sourceFile.getImportDeclarations();

	const importedModule =
		importDeclarations.find((importDeclaration) => {
			const text = importDeclaration.getModuleSpecifier().getText();
			return text.substring(1, text.length - 1) === moduleSpecifier;
		}) ?? null;

	// create import
	if (importedModule === null) {
		sourceFile.addImportDeclaration({
			namedImports,
			moduleSpecifier,
		});
		return;
	}

	if (!Array.isArray(namedImports)) {
		return;
	}

	namedImports.forEach((namedImport) => {
		const oldNamedImports = importedModule
			.getNamedImports()
			.map((i) => i.getText());

		const importName =
			typeof namedImport === 'string' ? namedImport : namedImport.name;

		if (!oldNamedImports.includes(importName)) {
			importedModule.addNamedImport(importName);
		}
	});
};
const insertDependencies = (
	sourceFile: SourceFile,
	dependencies: Record<string, Dependency>,
) => {
	let positionAfterImports = getPositionAfterImports(sourceFile);

	Object.values(dependencies).forEach(({ kind, text, structure }) => {
		if (kind === SyntaxKind.Parameter) {
			return;
		}

		if (kind === SyntaxKind.ImportDeclaration && structure !== null) {
			mergeOrCreateImports(sourceFile, structure);
			positionAfterImports++;
			return;
		}

		sourceFile.insertStatements(positionAfterImports, text);
	});
};

export const repomod: Repomod<Dependencies> = {
	includePatterns: ['**/pages/**/*.{jsx,tsx}'],
	excludePatterns: ['**/node_modules/**', '**/pages/api/**'],
	handleFile: async (api, path, options) => {
		const { unifiedFileSystem, tsmorph } = api.getDependencies();
		const parsedPath = posix.parse(path);

		const projectDir = parsedPath.dir.split('pages')[0] ?? null;

		if (projectDir === null) {
			return [];
		}

		if (project === null) {
			await initTsMorphProject(tsmorph, unifiedFileSystem, projectDir);
		}

		const componentTree = await buildComponentTree(tsmorph, path);

		const mergedMetadata = mergeMetadata(componentTree);
		const mergedDependencies = mergeDependencies(componentTree);

		if (
			Object.keys(mergedMetadata).length === 0 ||
			Object.keys(mergedDependencies).length === 0
		) {
			return [];
		}

		return [
			{
				kind: 'upsertFile',
				path,
				options: {
					...options,
					metadata: JSON.stringify(mergedMetadata),
					dependencies: JSON.stringify(mergedDependencies),
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
			const dependencies = JSON.parse(
				options.dependencies ?? '',
			) as Record<string, Dependency>;

			insertMetadata(sourceFile, metadata);
			insertDependencies(sourceFile, dependencies);

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
