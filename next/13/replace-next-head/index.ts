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
	JsxExpression,
	StringLiteral,
	JsxAttribute,
} from 'ts-morph';

import type {
	Repomod,
	UnifiedFileSystem,
} from '@intuita-inc/repomod-engine-api';
import type { fromMarkdown } from 'mdast-util-from-markdown';
import type { visit } from 'unist-util-visit';
import { posix, relative, isAbsolute, join } from 'node:path';
/**
 * Copied from "../replace-next-head"
 */

type Dependency = {
	kind: SyntaxKind;
	text: string;
	structure: ImportDeclarationStructure | null;
	isBindingPattern?: boolean;
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

const DEPENDENCY_TREE_MAX_DEPTH = 5;

const getDependenciesForIdentifiers = (
	identifiers: ReadonlyArray<Identifier>,
	depth: number = 0,
) => {
	if (depth > DEPENDENCY_TREE_MAX_DEPTH) {
		return {};
	}

	const dependencies: Record<string, Dependency> = {};

	identifiers.forEach((identifier) => {
		const parent = identifier.getParent();

		if (
			(Node.isPropertyAccessExpression(parent) ||
				Node.isElementAccessExpression(parent)) &&
			identifier.getChildIndex() !== 0
		) {
			return;
		}

		const [firstDefinition] =
			identifier.getSymbol()?.getDeclarations() ?? [];

		const localSourceFile = identifier.getFirstAncestorByKind(
			SyntaxKind.SourceFile,
		);
		// check if declaration exists in current sourceFile
		if (
			firstDefinition === undefined ||
			firstDefinition.getFirstAncestorByKind(SyntaxKind.SourceFile) !==
				localSourceFile
		) {
			return;
		}

		const importDeclarationPresent = identifier
			.getSourceFile()
			.getImportDeclarations()
			.some((importDeclaration) =>
				importDeclaration
					.getNamedImports()
					.some(
						(importSpecifier) =>
							importSpecifier.getNameNode().getText() ===
							identifier.getText(),
					),
			);

		const syntaxKinds = [
			SyntaxKind.Parameter,
			SyntaxKind.VariableStatement,
			SyntaxKind.ImportDeclaration,
			SyntaxKind.FunctionDeclaration,
		].filter(
			(syntaxKind) =>
				!importDeclarationPresent ||
				syntaxKind === SyntaxKind.ImportDeclaration,
		);

		let ancestor: Node | null = null;

		for (const syntaxKind of syntaxKinds) {
			if (ancestor !== null) {
				continue;
			}

			ancestor =
				firstDefinition.getKind() === syntaxKind
					? firstDefinition
					: firstDefinition.getFirstAncestorByKind(syntaxKind) ??
					  null;
		}

		if (ancestor === null) {
			return;
		}

		dependencies[identifier.getText()] = {
			text: ancestor.getText(),
			structure: getStructure(ancestor),
			kind: ancestor.getKind(),
			isBindingPattern:
				ancestor.getKind() === SyntaxKind.Parameter &&
				ancestor.getFirstDescendantByKind(
					SyntaxKind.ObjectBindingPattern,
				) !== undefined,
		};

		// recursivelly check for dependencies until reached parameter or import
		if (
			Node.isImportDeclaration(ancestor) ||
			Node.isParameterDeclaration(ancestor)
		) {
			return;
		}

		const ancestorIdentifiers = ancestor
			.getDescendantsOfKind(SyntaxKind.Identifier)
			.filter((i) => {
				if (i.getText() === identifier.getText()) {
					return false;
				}

				if (ancestor && Node.isFunctionDeclaration(ancestor)) {
					const declaration = i.getSymbol()?.getDeclarations()[0];

					// ensure we dont collect identifiers from function inner scope in nested functions
					if (
						declaration?.getFirstAncestorByKind(
							SyntaxKind.FunctionDeclaration,
						) === ancestor
					) {
						return false;
					}
				}

				const parent = i.getParent();

				return (
					!Node.isBindingElement(parent) &&
					!Node.isPropertyAssignment(parent) &&
					!(
						Node.isPropertyAccessExpression(parent) &&
						i.getChildIndex() !== 0
					)
				);
			});

		const dependenciesOfAncestor = getDependenciesForIdentifiers(
			ancestorIdentifiers,
			depth + 1,
		);
		Object.assign(dependencies, dependenciesOfAncestor);
	});

	return dependencies;
};

const handleJsxSelfClosingElement = (
	jsxSelfClosingElement: JsxSelfClosingElement,
	metadataContainer: Container<Record<string, any>>,
	settingsContainer: Container<Record<string, any>>,
) => {
	const tagName = jsxSelfClosingElement.getTagNameNode().getText();

	if (!['link', 'meta'].includes(tagName)) {
		return;
	}

	const parent = jsxSelfClosingElement.getParent();
	const parentIsBinaryExpression = Node.isBinaryExpression(parent);
	if (parentIsBinaryExpression) {
		const leftExpression = parent.getLeft();

		const identifiers = leftExpression.getDescendantsOfKind(
			SyntaxKind.Identifier,
		);
		const dependencies = getDependenciesForIdentifiers(identifiers);

		settingsContainer.set((prev) => ({
			...prev,
			dependencies: { ...prev.dependencies, ...dependencies },
		}));
	}

	const metadataAttributes = jsxSelfClosingElement
		.getAttributes()
		.filter((attribute): attribute is JsxAttribute =>
			Node.isJsxAttribute(attribute),
		)
		.reduce<Record<string, string>>((metadataAttributes, attribute) => {
			const name = attribute.getNameNode().getText();
			const initializer = attribute.getInitializer();

			if (Node.isStringLiteral(initializer)) {
				metadataAttributes[name] = initializer.getFullText();
			}

			if (Node.isJsxExpression(initializer)) {
				const identifiers = initializer.getDescendantsOfKind(
					SyntaxKind.Identifier,
				);

				const dependencies = getDependenciesForIdentifiers(identifiers);

				settingsContainer.set((prev) => ({
					...prev,
					dependencies: { ...prev.dependencies, ...dependencies },
				}));

				metadataAttributes[name] =
					initializer.getExpression()?.getText() ?? '';
			}

			return metadataAttributes;
		}, {});

	const metadataName = (
		tagName === 'link'
			? metadataAttributes.rel
			: metadataAttributes.name ?? metadataAttributes.property
	)?.replace(/\"/g, '');

	if (metadataName && knownNames.includes(metadataName)) {
		handleTag(
			{ tagName, metadataName, metadataAttributes },
			metadataContainer,
		);
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
			text += child.getFullText();
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

	handleTag(
		{
			tagName: 'title',
			metadataName: 'title',
			metadataAttributes: {
				children: `\`${text}\``,
			},
		},
		metadataContainer,
	);
};

const handleHeadChild = (
	child: Node,
	metadataContainer: Container<Record<string, any>>,
	settingsContainer: Container<Record<string, any>>,
) => {
	if (Node.isJsxElement(child)) {
		handleHeadChildJsxElement(child, metadataContainer, settingsContainer);
	}

	if (Node.isJsxSelfClosingElement(child)) {
		handleJsxSelfClosingElement(
			child,
			metadataContainer,
			settingsContainer,
		);
	}

	if (Node.isJsxExpression(child)) {
		const expression = child.getExpression();

		if (Node.isBinaryExpression(expression)) {
			handleHeadChild(
				expression.getRight(),
				metadataContainer,
				settingsContainer,
			);
		}
	}
};

const handleHeadJsxElement = (
	headJsxElement: JsxElement,
	metadataContainer: Container<Record<string, any>>,
	settingsContainer: Container<Record<string, any>>,
) => {
	const jsxChildren = headJsxElement.getJsxChildren();

	jsxChildren.forEach((child) => {
		handleHeadChild(child, metadataContainer, settingsContainer);
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
	{
		tagName,
		metadataName,
		metadataAttributes,
	}: {
		tagName: string;
		metadataName: string;
		metadataAttributes: Record<string, string>;
	},
	metadataContainer: Container<Record<string, any>>,
) => {
	const metadataObject = metadataContainer.get();
	if (metadataName === 'title') {
		metadataObject[metadataName] = metadataAttributes.children ?? '';
	}

	if (tagName === 'meta') {
		const content = metadataAttributes.content;

		if (otherMetaTags.includes(metadataName)) {
			if (!metadataObject.other) {
				metadataObject.other = {};
			}

			metadataObject.other[metadataName] = content;
			return;
		}

		if (metadataName.startsWith('article')) {
			const { content } = metadataAttributes;

			if (!metadataObject.openGraph) {
				metadataObject.openGraph = {};
			}

			if (metadataName === 'article:author') {
				if (!metadataObject.openGraph.authors) {
					metadataObject.openGraph.authors = [];
				}

				metadataObject.openGraph.authors.push(content);

				return;
			}

			if (metadataName === 'article:tag') {
				if (!metadataObject.openGraph.tags) {
					metadataObject.openGraph.tags = [];
				}

				metadataObject.openGraph.tags.push(content);

				return;
			}

			metadataObject.openGraph[
				camelize(metadataName.replace('article:', ''))
			] = content;

			return;
		}

		if (metadataName === 'author') {
			if (!metadataObject.authors) {
				metadataObject.authors = [];
			}

			metadataObject['authors'].push({ name: content });
			return;
		}

		if (metadataName === 'theme-color') {
			const { content, media } = metadataAttributes;

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

		if (metadataName === 'googlebot') {
			return;
		}

		if (metadataName.startsWith('og:')) {
			const n = camelize(metadataName.replace('og:', ''));

			if (!metadataObject.openGraph) {
				metadataObject.openGraph = {};
			}

			// image structured property
			if (metadataName.startsWith('og:image')) {
				const { content } = metadataAttributes;

				if (!metadataObject.openGraph.images) {
					metadataObject.openGraph.images = [];
				}

				if (
					metadataName === 'og:image:url' ||
					metadataName === 'og:image'
				) {
					metadataObject.openGraph.images.push({
						url: content,
					});
				} else {
					const image = metadataObject.openGraph.images.at(-1);
					const propName = metadataName.replace('og:image:', '');

					image[propName] = content;
				}

				return;
			}

			if (metadataName.startsWith('og:audio')) {
				const { content } = metadataAttributes;

				if (!metadataObject.openGraph.audio) {
					metadataObject.openGraph.audio = [];
				}

				if (metadataName === 'og:audio') {
					metadataObject.openGraph.audio.push({
						url: content,
					});
				} else {
					const audio = metadataObject.openGraph.audio.at(-1);
					const propName = metadataName.replace('og:audio:', '');

					audio[camelize(propName)] = content;
				}

				return;
			}

			if (metadataName.startsWith('og:video')) {
				const { content } = metadataAttributes;

				if (!metadataObject.openGraph.videos) {
					metadataObject.openGraph.videos = [];
				}

				if (metadataName === 'og:video') {
					metadataObject.openGraph.videos.push({
						url: content,
					});
				} else {
					const video = metadataObject.openGraph.videos.at(-1);
					const propName = metadataName.replace('og:video:', '');

					video[camelize(propName)] = content;
				}

				return;
			}

			if (metadataName === 'og:locale:alternate') {
				const { content } = metadataAttributes;

				if (!metadataObject.openGraph.alternateLocale) {
					metadataObject.openGraph.alternateLocale = [];
				}

				metadataObject.openGraph.alternateLocale.push(content);
				return;
			}

			metadataObject.openGraph[n] = content;
			return;
		}

		if (metadataName.startsWith('twitter:')) {
			const n = camelize(metadataName.replace('twitter:', ''));

			if (!metadataObject.twitter) {
				metadataObject.twitter = {};
			}

			if (metadataName === 'twitter:site:id') {
				metadataObject.twitter.siteId = content;
				return;
			}

			if (metadataName === 'twitter:creator:id') {
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

		if (Object.keys(verification).includes(metadataName)) {
			if (!metadataObject.verification) {
				metadataObject.verification = {};
			}

			const propName = verification[metadataName];

			if (!propName) {
				return;
			}

			metadataObject.verification[propName] = content;
			return;
		}

		if (metadataName === 'format-detection') {
			return;
		}

		const propertyName = camelize(metadataName);
		metadataObject[propertyName] = content;
	}

	if (tagName === 'link') {
		const content = metadataAttributes.href;

		if (metadataName === 'author') {
			if (metadataObject.authors.length === 0) {
				return;
			}

			metadataObject.authors[metadataObject.authors.length - 1].url =
				content;

			return;
		}

		if (['archives', 'assets', 'bookmarks'].includes(metadataName)) {
			if (!metadataObject[metadataName]) {
				metadataObject[metadataName] = [];
			}

			metadataObject[metadataName].push(content);

			return;
		}

		if (['canonical', 'alternate'].includes(metadataName)) {
			if (!metadataObject.alternates) {
				metadataObject.alternates = {};
			}

			if (metadataName === 'canonical') {
				metadataObject.alternates[metadataName] = content;
			}

			const { hreflang, media, type, href } = metadataAttributes;

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

		if (Object.keys(icons).includes(metadataName)) {
			const iconTypeName = icons[metadataName];
			const { sizes, type, href, rel } = metadataAttributes;

			if (!iconTypeName) {
				return;
			}

			if (!metadataObject.icons) {
				metadataObject.icons = {};
			}

			if (!metadataObject.icons[iconTypeName]) {
				metadataObject.icons[iconTypeName] = [];
			}

			const shouldIncludeRel = otherIcons.includes(metadataName);

			const iconMetadataObject = {
				...(sizes && { sizes }),
				...(type && { type }),
				...(href && { url: href }),
				...(shouldIncludeRel && rel && { rel }),
			};

			metadataObject.icons[iconTypeName].push(iconMetadataObject);
			return;
		}

		if (metadataName.startsWith('al:')) {
			return;
		}

		const propertyName = camelize(metadataName);
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

function formatObjectAsString(metadataObject: Record<string, any>) {
	const pairs: string[] = [];

	for (const [key, value] of Object.entries(metadataObject)) {
		if (Array.isArray(value)) {
			const formattedArray = value.map((element) =>
				typeof element === 'object' && element !== null
					? formatObjectAsString(element)
					: String(element),
			);

			pairs.push(`${key}: [${formattedArray.join(', \n')}]`);
		} else if (typeof value === 'object' && value !== null) {
			pairs.push(`${key}: ${formatObjectAsString(value)}`);
		} else {
			const keyIsValidIdentifier = isValidIdentifier(key);
			const keyDoubleQuotified = isDoubleQuotified(key);

			pairs.push(
				`${
					!keyIsValidIdentifier && !keyDoubleQuotified
						? `"${key}"`
						: key
				}: ${value}`,
			);
		}
	}

	return `{ ${pairs.join(', \n')} }`;
}

const buildMetadataStatement = (metadataObject: Record<string, unknown>) => {
	return `export const metadata: Metadata = ${formatObjectAsString(
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

type MetadataTreeNode = {
	path: string;
	components: Record<string, MetadataTreeNode>;
	metadata: Record<string, unknown>;
	dependencies: Record<string, Dependency>;
};

type FileAPI = Parameters<NonNullable<Repomod<Dependencies>['handleFile']>>[0];

let project: tsmorph.Project | null = null;

const defaultCompilerOptions = {
	allowJs: true,
	module: ModuleKind.CommonJS,
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
	compilerOptions?: tsmorph.CompilerOptions,
) => {
	const _compilerOptions = {
		...defaultCompilerOptions,
		...compilerOptions,
		baseUrl: rootPath,
	};

	project = new tsmorph.Project({
		useInMemoryFileSystem: true,
		skipFileDependencyResolution: true,
		compilerOptions: _compilerOptions,
	});

	const allFilePaths = await unifiedFileSystem.getFilePaths(
		rootPath,
		['**/*.{jsx,tsx,ts,js,cjs,ejs}'],
		['**/node_modules/**'],
	);

	for (const path of allFilePaths) {
		const content = await unifiedFileSystem.readFile(path);
		project.createSourceFile(path, content);
	}
};

const resolveModuleName = (path: string, containingPath: string) => {
	if (project === null) {
		return null;
	}

	return (
		tsmorph.ts.resolveModuleName(
			path,
			containingPath,
			project.getCompilerOptions(),
			project.getModuleResolutionHost(),
			undefined,
			undefined,
			ModuleKind.CommonJS,
		).resolvedModule?.resolvedFileName ?? null
	);
};

const getComponentPaths = (sourceFile: SourceFile) => {
	const paths = sourceFile
		.getDescendants()
		.filter(
			(d): d is JsxOpeningElement | JsxSelfClosingElement =>
				Node.isJsxOpeningElement(d) || Node.isJsxSelfClosingElement(d),
		)
		.map((componentTag) => {
			const nameNode = componentTag.getTagNameNode();
			const declaration = nameNode.getSymbol()?.getDeclarations()[0];

			return (
				declaration
					?.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)
					?.getModuleSpecifier()
					.getLiteralText() ?? null
			);
		})
		.filter((path): path is string => path !== null);

	return Array.from(new Set(paths));
};

const buildMetadataTreeNode = (containingPath: string) => {
	const treeNode: MetadataTreeNode = {
		path: containingPath,
		components: {},
		metadata: {},
		dependencies: {},
	};

	const sourceFile = project?.getSourceFile(containingPath) ?? null;

	if (sourceFile === null) {
		return treeNode;
	}

	const { metadata, dependencies } = buildComponentMetadata(sourceFile);

	treeNode.metadata = metadata;

	treeNode.dependencies = Object.entries(dependencies ?? {}).reduce<
		Record<string, Dependency>
	>((acc, [key, val]) => {
		if (
			val.kind === SyntaxKind.ImportDeclaration &&
			val.structure !== null
		) {
			const resolvedModuleName =
				resolveModuleName(
					val.structure.moduleSpecifier ?? '',
					containingPath,
				) ?? val.structure.moduleSpecifier;

			acc[key] = {
				...val,
				structure: {
					...val.structure,
					moduleSpecifier: resolvedModuleName,
				},
			};

			return acc;
		}

		acc[key] = val;

		return acc;
	}, {});

	getComponentPaths(sourceFile).forEach((path) => {
		const resolvedFileName = resolveModuleName(path, containingPath);

		if (resolvedFileName === null) {
			return;
		}

		treeNode.components[resolvedFileName] =
			buildMetadataTreeNode(resolvedFileName);
	});

	return treeNode;
};

const mergeMetadata = (treeNode: MetadataTreeNode): Record<string, unknown> => {
	const currentComponentMetadata = treeNode.metadata;

	return Object.entries(treeNode.components)
		.map((arr) => mergeMetadata(arr[1]))
		.reduce(
			(mergedMetadata, childMetadata) => ({
				...mergedMetadata,
				...childMetadata,
			}),
			currentComponentMetadata,
		);
};

const findComponentByModuleSpecifier = (
	sourceFile: SourceFile,
	componentAbsolutePath: string,
) => {
	return (
		sourceFile
			.getDescendants()
			.find((d): d is JsxOpeningElement | JsxSelfClosingElement => {
				if (
					!Node.isJsxOpeningElement(d) &&
					!Node.isJsxSelfClosingElement(d)
				) {
					return false;
				}

				const nameNode = d.getTagNameNode();
				const declaration = nameNode.getSymbol()?.getDeclarations()[0];

				const moduleSpecifier = declaration
					?.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)
					?.getModuleSpecifier()
					.getLiteralText();

				const absolutePath = resolveModuleName(
					moduleSpecifier ?? '',
					sourceFile.getFilePath().toString(),
				);

				return absolutePath === componentAbsolutePath;
			}) ?? null
	);
};

const findComponentPropValue = (
	path: string,
	componentPath: string,
): Record<string, JsxExpression | StringLiteral> => {
	const sourceFile = project?.getSourceFile(path) ?? null;

	if (sourceFile === null) {
		return {};
	}

	const component = findComponentByModuleSpecifier(sourceFile, componentPath);

	const propValue: Record<string, JsxExpression | StringLiteral> = {};

	const jsxAttributes =
		component?.getDescendantsOfKind(SyntaxKind.JsxAttribute) ?? [];

	jsxAttributes.forEach((jsxAttribute) => {
		const name = jsxAttribute.getNameNode().getText();

		const initializer = jsxAttribute.getInitializer();
		if (
			Node.isJsxExpression(initializer) ||
			Node.isStringLiteral(initializer)
		) {
			propValue[name] = initializer;
		}
	});

	return propValue;
};

const mergeDependencies = (
	treeNode: MetadataTreeNode,
	rootPath: string,
): MetadataTreeNode => {
	const currentComponentDependencies = treeNode.dependencies;

	treeNode.dependencies = Object.entries(treeNode.components)
		.map((arr) => mergeDependencies(arr[1], rootPath))
		.reduce((mergedDependencies, childTreeNode) => {
			const componentPropsValues = findComponentPropValue(
				treeNode.path,
				childTreeNode.path,
			);

			const mapped = Object.entries(childTreeNode.dependencies).reduce(
				(acc, [identifierName, value]) => {
					if (value.kind === SyntaxKind.Parameter) {
						const propValue =
							componentPropsValues[identifierName] ?? null;

						// handle props object
						if (!value.isBindingPattern) {
							const propsObjectText = Object.entries(
								componentPropsValues,
							).reduce<Record<string, string>>(
								(acc, [key, value]) => {
									acc[key] = Node.isJsxExpression(value)
										? value.getExpression()?.getText() ?? ''
										: value.getText();

									return acc;
								},
								{},
							);

							acc[identifierName] = {
								kind: SyntaxKind.VariableStatement,
								text: `const ${identifierName} = ${formatObjectAsString(
									propsObjectText,
								)}`,
								structure: null,
							};

							const identifiers: Identifier[] = [];

							Object.values(componentPropsValues).forEach(
								(propValue) => {
									identifiers.push(
										...propValue.getDescendantsOfKind(
											SyntaxKind.Identifier,
										),
									);
								},
							);

							const newDependencies =
								getDependenciesForIdentifiers(identifiers);

							Object.entries(newDependencies).forEach(
								([identifier, dependency]) => {
									if (
										rootPath === treeNode.path &&
										dependency.kind !== SyntaxKind.Parameter
									) {
										return;
									}

									acc[identifier] = dependency;
								},
							);

							return acc;
						}

						if (propValue === null) {
							return acc;
						}

						const identifiers = propValue.getDescendantsOfKind(
							SyntaxKind.Identifier,
						);

						const newDependencies =
							getDependenciesForIdentifiers(identifiers);

						//add dependencies of propValue
						Object.entries(newDependencies).forEach(
							([identifier, dependency]) => {
								if (
									rootPath === treeNode.path &&
									dependency.kind !== SyntaxKind.Parameter
								) {
									return;
								}

								acc[identifier] = dependency;
							},
						);

						// add propValue declaration

						const propValueText = Node.isJsxExpression(propValue)
							? propValue.getExpression()?.getText() ?? ''
							: propValue.getText();

						if (propValueText !== identifierName) {
							acc[identifierName] = {
								kind: SyntaxKind.VariableStatement,
								text: `const ${identifierName} = ${propValueText}`,
								structure: null,
							};
						}

						return acc;
					}

					acc[identifierName] = value;
					return acc;
				},
				{} as Record<string, Dependency>,
			);

			return { ...mergedDependencies, ...mapped };
		}, currentComponentDependencies);

	return treeNode;
};

const insertGenerateMetadataFunctionDeclaration = (
	sourceFile: SourceFile,
	metadataObject: Record<string, unknown>,
	propsParameterText: string,
) => {
	sourceFile.addStatements(
		`  
			export async function generateMetadata(
				{ params }: { params: Record<string, string | string[]>; },
			): Promise<Metadata> {
					const getStaticPropsResult  = await getStaticProps({ params });
					
					if (!('props' in getStaticPropsResult)) {
						return {}
					}
					
				  const ${propsParameterText} = getStaticPropsResult.props;
					
					return ${formatObjectAsString(metadataObject)};
					}	`,
	);
};

const insertMetadata = (
	sourceFile: SourceFile,
	metadataObject: Record<string, unknown>,
	param: (Dependency & { kind: SyntaxKind.Parameter }) | null,
) => {
	if (Object.keys(metadataObject).length === 0) {
		return undefined;
	}

	const positionAfterImports = getPositionAfterImports(sourceFile);

	if (param !== null) {
		insertGenerateMetadataFunctionDeclaration(
			sourceFile,
			metadataObject,
			param.text,
		);
	} else {
		sourceFile.insertStatements(
			positionAfterImports,
			buildMetadataStatement(metadataObject),
		);
	}

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

	return (lastImportDeclaration?.getChildIndex() ?? 0) + 1;
};

const mergeOrCreateImports = (
	sourceFile: SourceFile,
	{
		moduleSpecifier,
		namedImports,
		defaultImport,
	}: ImportDeclarationStructure,
	path: string,
) => {
	const importDeclarations = sourceFile.getImportDeclarations();

	const importedModule =
		importDeclarations.find((importDeclaration) => {
			const oldSpecifierText = importDeclaration
				.getModuleSpecifier()
				.getText();

			// compare by absolute paths
			const oldPath = resolveModuleName(
				oldSpecifierText.substring(1, oldSpecifierText.length - 1),
				path,
			);

			return oldPath === moduleSpecifier;
		}) ?? null;

	const pathIsAbsolute = isAbsolute(moduleSpecifier);

	// create import
	if (importedModule === null) {
		sourceFile.addImportDeclaration({
			defaultImport,
			namedImports,
			moduleSpecifier: pathIsAbsolute
				? relative(path, moduleSpecifier)
				: moduleSpecifier,
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
	path: string,
	usesDynamicMetadata: boolean,
) => {
	let positionAfterImports = getPositionAfterImports(sourceFile);

	Object.values(dependencies).forEach(({ kind, text, structure }) => {
		if (kind === SyntaxKind.Parameter) {
			return;
		}

		if (kind === SyntaxKind.ImportDeclaration && structure !== null) {
			mergeOrCreateImports(sourceFile, structure, path);
			positionAfterImports++;
			return;
		}

		if (usesDynamicMetadata) {
			const generateMetadataBody = sourceFile
				.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)
				.find((f) => f.getName() === 'generateMetadata')
				?.getBody();

			if (Node.isBlock(generateMetadataBody)) {
				// position after
				// const { x } = getStaticPropsResult.props;
				// in generateMetadata function
				const POS_AFTER_PROPERTIES_ACCESS = 3;
				generateMetadataBody?.insertStatements(
					POS_AFTER_PROPERTIES_ACCESS,
					text,
				);
			}

			return;
		}

		sourceFile.insertStatements(positionAfterImports, text);
	});
};

// @TODO monorepo support
const getTsCompilerOptions = async (api: FileAPI, baseUrl: string) => {
	const tsConfigPath = join(baseUrl, 'tsconfig.json');

	try {
		const tsConfigStr = await api.readFile(tsConfigPath);
		const configWithoutComments = tsConfigStr.replace(/^\s*?\/\/.*$/gm, '');
		return JSON.parse(configWithoutComments).compilerOptions;
	} catch (e) {
		console.error(e);
		return {};
	}
};

export const repomod: Repomod<Dependencies> = {
	includePatterns: ['**/pages/**/*.{jsx,tsx,js,ts,cjs,ejs}'],
	excludePatterns: ['**/node_modules/**', '**/pages/api/**'],
	handleFile: async (api, path, options) => {
		const { unifiedFileSystem, tsmorph } = api.getDependencies();
		const parsedPath = posix.parse(path);

		const baseUrl = parsedPath.dir.split('pages')[0] ?? null;

		if (baseUrl === null) {
			return [];
		}

		const { paths } = await getTsCompilerOptions(api, baseUrl);
		await initTsMorphProject(tsmorph, unifiedFileSystem, baseUrl, {
			paths,
		});

		const metadataTree = buildMetadataTreeNode(path);
		const mergedMetadata = mergeMetadata(metadataTree);

		const { dependencies: mergedDependencies } = mergeDependencies(
			metadataTree,
			path,
		);

		if (Object.keys(mergedMetadata).length === 0) {
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
				options.dependencies ?? '{}',
			) as Record<string, Dependency>;

			// check if we have dependency on component arguments after merging metadata
			// if we have,it means that page probably gets props from data hooks
			const param =
				Object.values(dependencies).find(
					(d): d is Dependency & { kind: SyntaxKind.Parameter } =>
						d.kind === SyntaxKind.Parameter,
				) ?? null;

			insertMetadata(sourceFile, metadata, param);
			insertDependencies(sourceFile, dependencies, path, Boolean(param));

			return {
				kind: 'upsertData',
				path,
				data: sourceFile.getFullText(),
			};
		} catch (e) {
			console.error(e);
		}

		return {
			kind: 'noop',
		};
	},
};
