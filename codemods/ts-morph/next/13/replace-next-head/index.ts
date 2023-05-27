import { EmitHint, JsxSelfClosingElement, ts } from 'ts-morph';
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

const handleJsxSelfClosingElement = (
	jsxSelfClosingElement: JsxSelfClosingElement,
	metadataContainer: Container<ReadonlyArray<ParsedMetadataTag>>,
) => {
	const tagName = jsxSelfClosingElement.getTagNameNode().getText();

	if (tagName !== 'link' && tagName !== 'meta') {
		return;
	}

	const attributes = jsxSelfClosingElement.getAttributes();
	const attributesObject: Record<string, string> = {};

	attributes.forEach((attribute) => {
		if (Node.isJsxAttribute(attribute)) {
			const name = attribute.getName();
			const initializer = attribute.getInitializer();
			if (Node.isStringLiteral(initializer)) {
				attributesObject[name] = initializer.getText();
			} else if (Node.isJsxExpression(initializer)) {
				attributesObject[name] =
					initializer.getExpression()?.getText() ?? '';
			}
		}
	});

	metadataContainer.set((prevMetadata) => {
		return [
			...prevMetadata,
			{
				HTMLTagName: tagName,
				HTMLAttributes: attributesObject,
			},
		];
	});

	jsxSelfClosingElement.replaceWithText('');
};

const handleHeadChildJsxElement = (
	jsxElement: JsxElement,
	metadataContainer: Container<ReadonlyArray<ParsedMetadataTag>>,
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

	metadataContainer.set((prevMetadata) => {
		return [...prevMetadata, parsedTag];
	});

	jsxElement.replaceWithText('');
};

const handleHeadJsxElement = (
	headJsxElement: JsxElement,
	metadataContainer: Container<ReadonlyArray<ParsedMetadataTag>>,
) => {
	const jsxChildren = headJsxElement.getJsxChildren();

	jsxChildren.forEach((child) => {
		if (Node.isJsxElement(child)) {
			handleHeadChildJsxElement(child, metadataContainer);
		} else if (Node.isJsxSelfClosingElement(child)) {
			handleJsxSelfClosingElement(child, metadataContainer);
		}
	});
};

const handleHeadIdentifier = (
	headIdentifier: Identifier,
	metadataContainer: Container<ReadonlyArray<ParsedMetadataTag>>,
) => {
	let jsxHeadElement: JsxElement | undefined;

	headIdentifier.findReferencesAsNodes().forEach((node) => {
		const parent = node.getParent();

		if (Node.isJsxOpeningElement(parent)) {
			const grandparent = parent.getParent();

			if (Node.isJsxElement(grandparent)) {
				jsxHeadElement = grandparent;
				handleHeadJsxElement(grandparent, metadataContainer);
			}
		}
	});

	const children = jsxHeadElement?.getJsxChildren() ?? [];
	const withoutJsxText = children.filter((c) => !Node.isJsxText(c));
	const text = withoutJsxText.reduce((t, c) => (t += c.getFullText()), '');

	jsxHeadElement?.setBodyTextInline(text);
};

const handleImportDeclaration = (
	importDeclaration: ImportDeclaration,
	metadataContainer: Container<ReadonlyArray<ParsedMetadataTag>>,
) => {
	const moduleSpecifier = importDeclaration.getModuleSpecifier();

	if (moduleSpecifier.getLiteralText() !== 'next/head') {
		return;
	}

	const headIdentifier = importDeclaration.getDefaultImport() ?? null;

	if (headIdentifier === null) {
		return;
	}

	handleHeadIdentifier(headIdentifier, metadataContainer);
};

export const getMetadataObject = (
	parsedMetadataTags: readonly ParsedMetadataTag[],
) => {
	const metadataObject: Record<string, any> = {};
	parsedMetadataTags.forEach(({ HTMLTagName, HTMLAttributes }) => {
		if (HTMLTagName === 'title') {
			metadataObject[HTMLTagName] = HTMLAttributes.children ?? '';
		}

		if (HTMLTagName === 'meta') {
			const name =
				(HTMLAttributes.name ?? HTMLAttributes.property)?.replace(
					/\"/g,
					'',
				) ?? null;

			if (name === null) {
				return;
			}

			const content = HTMLAttributes.content;

			if (name === 'author') {
				if (!metadataObject.authors) {
					metadataObject.authors = [];
				}

				metadataObject['authors'].push({ name: content });
				return;
			}

			// @TODO support arrays
			if (name === 'theme-color') {
				const { content, media } = HTMLAttributes;

				metadataObject.themeColor = {
					color: content,
					media,
				};
				return;
			}

			if (name.startsWith('og:')) {
				const n = camelize(name.replace('og:', ''));

				if (!metadataObject.openGraph) {
					metadataObject.openGraph = {};
				}

				if (name.startsWith('og:image')) {
					const n = camelize(name.replace('og:image', ''));

					// @TODO support arrays
					if (!metadataObject.openGraph.images) {
						metadataObject.openGraph.images = {};
					}

					if (name === 'og:image') {
						metadataObject.openGraph.images.url = content;
						return;
					}

					metadataObject.openGraph.images[n] = content;
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
				me: 'me',
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
				// @TODO
				metadataObject.formatDetection = {};
				return;
			}

			const propertyName = camelize(name);
			metadataObject[propertyName] = content;
		}

		if (HTMLTagName === 'link') {
			const name = HTMLAttributes.rel?.replace(/\"/g, '') ?? null;

			if (name === null) {
				return;
			}

			const content = HTMLAttributes.href;

			// @TODO support arrays
			if (name === 'author') {
				return;
			}

			if (name === 'canonical' || name === 'alternate') {
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
				metadataObject.appLinks = {};

				return;
			}

			const propertyName = camelize(name);
			metadataObject[propertyName] = content;
		}
	});

	return metadataObject;
};

const buildMetadataObjectStr = (metadataObject: Record<string, any>) => {
	let str = '{';
	Object.keys(metadataObject).forEach((key) => {
		const val = metadataObject[key];
		const value =
			typeof val === 'string'
				? val
				: typeof val === 'object' && val !== null
				? buildMetadataObjectStr(val)
				: '';
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

export const handleSourceFile = (
	sourceFile: SourceFile,
): string | undefined => {
	const metadataContainer = buildContainer<ReadonlyArray<ParsedMetadataTag>>(
		[],
	);
	const importDeclarations = sourceFile.getImportDeclarations();

	importDeclarations.forEach((importDeclaration) =>
		handleImportDeclaration(importDeclaration, metadataContainer),
	);

	const hasChanges = metadataContainer.get().length !== 0;

	if (!hasChanges) {
		return undefined;
	}

	const metadataObject = getMetadataObject(metadataContainer.get());

	const declaration = [...importDeclarations].pop();

	const pos = declaration?.wasForgotten()
		? 0
		: (declaration?.getChildIndex() ?? 0) + 1;

	sourceFile.insertStatements(pos, buildMetadataStatement(metadataObject));
	sourceFile.insertStatements(0, 'import { Metadata } from "next";');
	return sourceFile.print({ emitHint: EmitHint.SourceFile });
};
