import { EmitHint } from "ts-morph";
import { SyntaxKind } from "ts-morph";
import { Identifier, ImportDeclaration, JsxElement, Node, SourceFile } from "ts-morph";

const ctx: { tag: 'title' | 'meta', attributes: Record<string, string>}[] = [];

const isTitleJsxElement  = (jsxElement: JsxElement) => {
  const openingElement = jsxElement.getOpeningElement();
  const tagNameNode = openingElement.getTagNameNode()

  return tagNameNode.getText() === 'title'
} 

const isMetaJsxElement = (jsxElement: JsxElement) => {
  const openingElement = jsxElement.getOpeningElement();
  const tagNameNode = openingElement.getTagNameNode()

  return tagNameNode.getText() === 'meta'; 
}

const handleTitleJsxElement = (titleJsxElement: JsxElement) => {
  const children = titleJsxElement.getJsxChildren();

  children.forEach((node) => {
    if(Node.isJsxText(node)) {
      ctx.push({
        tag: 'title', 
        attributes: {
          children: children[0]?.getText() ?? '', 
        }
      })
    }
  })
}

const handleMetaJsxElement = (metaJsxElement: JsxElement) => {

}

const handleHeadChildJsxElement = (headChildJsxElement: JsxElement) => {
  if(isTitleJsxElement(headChildJsxElement)) {
    handleTitleJsxElement(headChildJsxElement);
  } else if(isMetaJsxElement(headChildJsxElement)) {
    handleMetaJsxElement(headChildJsxElement);
  }
};


const handleHeadJsxElement = (headJsxElement: JsxElement) => {
  const jsxChildren = headJsxElement.getJsxChildren();

  jsxChildren.forEach((child) => {
    if(Node.isJsxElement(child)) {
      handleHeadChildJsxElement(child)
    }
  })

}

const handleHeadIdentifier = (headIdentifier: Identifier) => {
	headIdentifier
		.findReferencesAsNodes()
		.forEach((node) => {
      const headJsxElement = node.getFirstAncestorByKind(SyntaxKind.JsxElement);

			if (headJsxElement) {
        handleHeadJsxElement(headJsxElement)
			}
		});
}

const handleImportDeclaration = (importDeclaration: ImportDeclaration)  => {
  const moduleSpecifier = importDeclaration.getModuleSpecifier();

	if (moduleSpecifier.getLiteralText() !== 'next/head') {
		return;
	}

  const headIdentifier = importDeclaration.getDefaultImport() ?? null;


  if(headIdentifier === null) {
    return;
  }

  handleHeadIdentifier(headIdentifier);

  importDeclaration.remove();
}

const getMetadataObject = () => {
  return  { title: 'My Page Title'};
}
export const handleSourceFile = (sourceFile: SourceFile): string | undefined => {
	const importDeclarations = sourceFile.getImportDeclarations();

  importDeclarations.forEach((importDeclaration) =>
    handleImportDeclaration(importDeclaration)
  );

  const hasHeadImports = true;
  const metadataObject = getMetadataObject();


  sourceFile.insertStatements(
    0,
    `export const metadata: Metadata = ${JSON.stringify(metadataObject)}`,
  );

  if(hasHeadImports) {
    sourceFile.insertStatements(
			0,
			'import { Metadata } from "next";',
		);
  }

 return sourceFile.print({ emitHint: EmitHint.SourceFile });;
}