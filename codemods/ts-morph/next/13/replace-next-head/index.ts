import { EmitHint, JsxSelfClosingElement } from 'ts-morph';
import {
	Identifier,
	ImportDeclaration,
	JsxElement,
	Node,
	SourceFile,
} from 'ts-morph';

type HTMLTagName = 'title' | 'meta' | 'link';
type HTMLAttributes = Record<string, string>;
type ParsedMetadataTag = {
	HTMLTagName: HTMLTagName;
	HTMLAttributes: HTMLAttributes;
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

const isTitleJsxElement = (jsxElement: JsxElement) => {
	const openingElement = jsxElement.getOpeningElement();
	const tagNameNode = openingElement.getTagNameNode();

	return tagNameNode.getText() === 'title';
};

const isMetaJsxElement = (jsxElement: JsxSelfClosingElement) => {
	return jsxElement.getTagNameNode().getText() === 'meta';
};

const handleTitleJsxElement = (
	titleJsxElement: JsxElement,
	metadataContainer: Container<ReadonlyArray<ParsedMetadataTag>>,
) => {
	const children = titleJsxElement.getJsxChildren();
	const firstChild = children[0];

	let text = '';
	if (Node.isJsxText(firstChild)) {
		// @TODO
		text = `"${firstChild.getText()}"`;
	} else if (Node.isJsxExpression(firstChild)) {
		text = firstChild.getExpression()?.getText() ?? '';
	}

	const parsedTag = {
		HTMLTagName: 'title' as const,
		HTMLAttributes: {
			children: text,
		},
	};

	metadataContainer.set((prevMetadata) => {
		return [...prevMetadata, parsedTag];
	});

	titleJsxElement.replaceWithText('');
};

const handleMetaJsxSelfClosingElement = (
	metaJsxElement: JsxSelfClosingElement,
	metadataContainer: Container<ReadonlyArray<ParsedMetadataTag>>,
) => {
	const attributes = metaJsxElement.getAttributes();
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
				HTMLTagName: 'meta',
				HTMLAttributes: attributesObject,
			},
		];
	});

	metaJsxElement.replaceWithText('');
};

const handleHeadChildJsxElement = (
	headChildJsxElement: JsxElement,
	metadataContainer: Container<ReadonlyArray<ParsedMetadataTag>>,
) => {
	if (isTitleJsxElement(headChildJsxElement)) {
		handleTitleJsxElement(headChildJsxElement, metadataContainer);
	}
};

const handleHeadChildJsxSelfClosingElement = (
	headChildJsxSelfClosingElement: JsxSelfClosingElement,
	metadataContainer: Container<ReadonlyArray<ParsedMetadataTag>>,
) => {
	if (isMetaJsxElement(headChildJsxSelfClosingElement)) {
		handleMetaJsxSelfClosingElement(
			headChildJsxSelfClosingElement,
			metadataContainer,
		);
	}
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
			handleHeadChildJsxSelfClosingElement(child, metadataContainer);
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

	if (!jsxHeadElement) {
		return;
	}
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

	importDeclaration.remove();
};

// @TODO fix code duplication
const resolveProperty = (propertyName: string) => {
	const map: Record<string, string> = {
		title: 'title',
		description: 'description',
		'application-name': 'applicationName',
		author: 'authors',
		generator: 'generator',
		keywords: 'keywords',
		referrer: 'referrer',
		'theme-color': 'themeColor',
		'color-scheme': 'colorScheme',
		viewport: 'viewport',
		creator: 'creator',
		publisher: 'publisher',
	};

	return map[propertyName] ?? null;
};

const resolveOpenGraphProperty = (propertyName: string): string | null => {
	const map: Record<string, string> = {
		'og:type': 'type',
		'og:url': 'url',
		'og:site_name': 'siteName',
		'og:title': 'title',
		'og:description': 'description',
	};

	return map[propertyName] ?? null;
};

const resolveTwitterProperty = (propertyName: string): string | null => {
	const map: Record<string, string> = {
		'twitter:card': 'card',
		'twitter:site': 'site',
		'twitter:creator': 'creator',
		'twitter:title': 'title',
		'twitter:description': 'description',
	};

	return map[propertyName] ?? null;
};

const handleOpenGraphAttribute = (
	metadataObject: Record<string, any>,
	name: string,
	content: string,
) => {
	if (!metadataObject.openGraph) {
		metadataObject.openGraph = {};
	}

	const resolvedPropertyName = resolveOpenGraphProperty(name);

	if (resolvedPropertyName === null) {
		return;
	}

	metadataObject.openGraph[resolvedPropertyName] = content;
};

const handleTwitterAttribute = (
	metadataObject: Record<string, any>,
	name: string,
	content: string,
) => {
	if (!metadataObject.twitter) {
		metadataObject.twitter = {};
	}

	const resolvedPropertyName = resolveTwitterProperty(name);

	if (resolvedPropertyName === null) {
		return;
	}

	metadataObject.twitter[resolvedPropertyName] = content;
};

const handleBaseAttribute = (
	metadataObject: Record<string, any>,
	name: string,
	content: string,
) => {
	const resolvedPropertyName = resolveProperty(name);

	if (resolvedPropertyName === null) {
		return;
	}

	metadataObject[resolvedPropertyName] = content;
};

const getMetadataObject = (
	metadataContainer: Container<ReadonlyArray<ParsedMetadataTag>>,
) => {
	const metadataObject: Record<string, any> = {};
	const parsedMetadataTags = metadataContainer.get();

	parsedMetadataTags.forEach(({ HTMLTagName, HTMLAttributes }) => {
		if (HTMLTagName === 'title') {
			metadataObject[HTMLTagName] = HTMLAttributes.children ?? '';
		}

		const nameAttribute =
			(HTMLAttributes.name ?? HTMLAttributes.property)?.replace(
				/\"/g,
				'',
			) ?? '';

		if (!nameAttribute) {
			return;
		}

		const contentAttribute = HTMLAttributes.content ?? '';
		const isOpenGraphAttribute = nameAttribute.startsWith('og:');
		const isTwitterAttribute = nameAttribute.startsWith('twitter:');

		if (HTMLTagName === 'meta' && isOpenGraphAttribute) {
			handleOpenGraphAttribute(
				metadataObject,
				nameAttribute,
				contentAttribute,
			);
		} else if (HTMLTagName === 'meta' && isTwitterAttribute) {
			handleTwitterAttribute(
				metadataObject,
				nameAttribute,
				contentAttribute,
			);
		} else {
			handleBaseAttribute(
				metadataObject,
				nameAttribute,
				contentAttribute,
			);
		}

		// @TODO verification
		// @TODO others

		// @TODO <link>
	});

	return metadataObject;
};

const buildMetadataObjectStr = (metadataObject: Record<string, string>) => {
	let str = '{';

	Object.keys(metadataObject).forEach((key) => {
		const val = metadataObject[key];
		const value =
			typeof val === 'string'
				? val
				: typeof val === 'object' && val !== null
				? buildMetadataObjectStr(val)
				: '';
		str += `\n ["${key}"]: ${value},`;
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

	const hasHeadImports = true;
	const metadataObject = getMetadataObject(metadataContainer);

	sourceFile.insertStatements(0, buildMetadataStatement(metadataObject));

	if (hasHeadImports) {
		sourceFile.insertStatements(0, 'import { Metadata } from "next";');
	}

	return sourceFile.print({ emitHint: EmitHint.SourceFile });
};
