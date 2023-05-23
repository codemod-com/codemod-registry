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

const metadataFlatProps: Record<string, string> = {
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

// const openGraphMetadata: Record<string, string> = {
// 	'og:type': 'type',
// 	'og:url': 'url',
// 	'og:site_name': 'siteName',
// 	'og:title': 'title',
// 	'og:description': 'description',
// };

const getMetadataObject = (
	metadataContainer: Container<ReadonlyArray<ParsedMetadataTag>>,
) => {
	const metadataObject: Record<string, string> = {};
	const parsedMetadataTags = metadataContainer.get();

	parsedMetadataTags.forEach(({ HTMLTagName, HTMLAttributes }) => {
		if (HTMLTagName === 'title') {
			metadataObject[HTMLTagName] = HTMLAttributes.children ?? '';
		}

		if (
			HTMLTagName === 'meta' &&
			HTMLAttributes.name &&
			metadataFlatProps[HTMLAttributes.name.replace(/\"/g, '')] !==
				undefined
		) {
			// @TODO fix hacks
			metadataObject[HTMLAttributes.name.replace(/\"/g, '')!] =
				HTMLAttributes.content ?? '';
		}

		// if (
		// 	HTMLTagName === 'meta' &&
		// 	HTMLAttributes.name &&
		// 	openGraphMetadata[HTMLAttributes.name] !== undefined
		// ) {
		// 	metadataObject[openGraphMetadata[HTMLAttributes.name]!] =
		// 		HTMLAttributes.content ?? '';
		// }

		// @TODO twitter meta
		// @TODO verification
		// @TODO others

		// @TODO <link>
	});

	return metadataObject;
};

const buildMetadataObjectStr = (metadataObject: Record<string, string>) => {
	let str = '{';

	Object.keys(metadataObject).forEach((key) => {
		const value = metadataObject[key];
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
