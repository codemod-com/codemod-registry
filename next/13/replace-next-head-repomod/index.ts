import tsmorph, { ModuleKind, SourceFile } from 'ts-morph';
import type { Repomod, UnifiedFileSystem } from '@intuita-inc/repomod-engine-api';
import type { fromMarkdown } from 'mdast-util-from-markdown';
import type { visit } from 'unist-util-visit';

type Root = ReturnType<typeof fromMarkdown>;

// eslint-disable-next-line @typescript-eslint/ban-types
type Dependencies = Readonly<{
	tsmorph: typeof tsmorph;
	parseMdx?: (data: string) => Root;
	stringifyMdx?: (tree: Root) => string;
	visitMdxAst?: typeof visit;
	unifiedFileSystem: UnifiedFileSystem;
}>;


const getModuleSpecifiersValues = (
	sourceFile: SourceFile,
): string[] => {
	const result: string[] = [];
	const importDeclarations = sourceFile.getImportDeclarations();
	

	importDeclarations.forEach((importDeclaration) => {
		result.push(importDeclaration.getModuleSpecifierValue());
	});
	

	return result;
};

const resolveDependencies = async (unifiedFileSystem: Dependencies['unifiedFileSystem'],tsmorph: Dependencies['tsmorph'], path: string, content: string): Promise<string[]> => {
	const project = new tsmorph.Project({
		useInMemoryFileSystem: true,
		skipFileDependencyResolution: true,
		// @TODO pass resolved config
		compilerOptions: {
			allowJs: true,
			module: ModuleKind.ESNext, 
			traceResolution: true, 
		},
	});
	
	// @TODO
	const rootName = '/opt/project';

	const allFilePaths = await unifiedFileSystem.getFilePaths(rootName, ['**/*.{jsx,tsx}'], []);
	console.log(allFilePaths, 'all files')
	
	// @TODO is there better way to attach files to ts-morph virtual fs? 
	for(const filePath of allFilePaths) {
		if(path === filePath) {
			continue;
		}
		const content = await unifiedFileSystem.readFile(filePath);
		project.createSourceFile(filePath, content);
	}
	
	console.log('HERE')
	
	const sourceFile = project.createSourceFile(path, content);
	const paths = getModuleSpecifiersValues(sourceFile);
	console.log(paths, 'relative paths');
	const res = tsmorph.ts.resolveModuleName(paths[0] as string, path, project.getCompilerOptions(), project.getModuleResolutionHost(),undefined, undefined, ModuleKind.ESNext );
console.log(res, 'resolved with tsm');
	return paths;
}

export const repomod: Repomod<Dependencies> = {
	includePatterns: ['**/pages/**/*.{jsx,tsx}'],
	excludePatterns: ['**/node_modules/**', '**/pages/api/**'],
	handleFile: async (api, path, options) => {
		const fileContent = await api.readFile(path);
		const {unifiedFileSystem, tsmorph } = api.getDependencies();
		const paths = resolveDependencies(unifiedFileSystem, tsmorph, path, fileContent);
		
		return [];
	},
	handleData: async (api, path, __, options) => {
		return {
			kind: 'noop'
		}
	},
};
