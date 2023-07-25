import tsmorph, {
	Identifier,
	JsxOpeningElement,
	JsxSelfClosingElement,
	ModuleKind,
	Node,
	SourceFile,
} from 'ts-morph';

import type {
	Repomod,
	UnifiedFileSystem,
} from '@intuita-inc/repomod-engine-api';
import type { fromMarkdown } from 'mdast-util-from-markdown';
import type { visit } from 'unist-util-visit';
import {
	Definition,
	buildContainer,
	collectTopLevelDefinitions,
	handleImportDeclaration,
} from '../replace-next-head/index.js';

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
	compilerOptions: tsmorph.CompilerOptions = defaultCompilerOptions,
) => {
	project = new tsmorph.Project({
		useInMemoryFileSystem: true,
		skipFileDependencyResolution: true,
		// @TODO pass resolved config
		compilerOptions,
	});

	const rootName = '/opt/project';
	const allFilePaths = await unifiedFileSystem.getFilePaths(
		rootName,
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
				const attributes = jsxElement.getAttributes();
				attributes.forEach((attribute) => {
					if (Node.isJsxAttribute(attribute)) {
						const name = attribute.getNameNode().getText();
						const initializer = attribute.getInitializer();

						treeNode.components[resolvedFileName] = {
							path,
							props: {},
							metadata: {},
							components: {},
						};

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

export const repomod: Repomod<Dependencies> = {
	includePatterns: ['**/pages/**/*.{jsx,tsx}'],
	excludePatterns: ['**/node_modules/**', '**/pages/api/**'],
	handleFile: async (api, path) => {
		const { unifiedFileSystem, tsmorph } = api.getDependencies();

		if (project === null) {
			await initTsMorphProject(tsmorph, unifiedFileSystem);
		}

		const componentTree: ComponentTreeNode = {
			path,
			components: {},
			props: {},
			metadata: {},
		};

		await buildComponentTree(tsmorph, path, componentTree);

		console.log(JSON.stringify(componentTree, null, 2));
		return [];
	},
	handleData: async () => {
		return {
			kind: 'noop',
		};
	},
};
