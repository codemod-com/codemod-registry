import tsmorph from 'ts-morph';

import type {
	Repomod,
	UnifiedFileSystem,
} from '@intuita-inc/repomod-engine-api';
import type { fromMarkdown } from 'mdast-util-from-markdown';
import type { visit } from 'unist-util-visit';
import { posix } from 'node:path';
import { ParsedPath } from 'path/posix';

type Root = ReturnType<typeof fromMarkdown>;

// eslint-disable-next-line @typescript-eslint/ban-types
type Dependencies = Readonly<{
	tsmorph: typeof tsmorph;
	parseMdx?: (data: string) => Root;
	stringifyMdx?: (tree: Root) => string;
	visitMdxAst?: typeof visit;
	unifiedFileSystem: UnifiedFileSystem;
}>;


const getNewDirectoryName = ({ dir, name }: ParsedPath) => {
	const directoryNameSegments = dir.split(posix.sep);

	const newDirectoryNameSegments = directoryNameSegments.map(segment => segment === 'pages' ? 'app' : segment);

	if (name !== 'index') {
		newDirectoryNameSegments.push(name);
	}

	return newDirectoryNameSegments.join(posix.sep);
}


export const repomod: Repomod<Dependencies> = {
	includePatterns: ['**/pages/api/**/*.{js,ts,cjs,ejs}'],
	excludePatterns: ['**/node_modules/**'],
	handleFile: async (api, path) => {
		const parsedPath = posix.parse(path);

		const oldData = await api.readFile(path);

		return [{
			kind: 'upsertFile',
			path: posix.format({
				root: parsedPath.root,
				dir: getNewDirectoryName(parsedPath),
				ext: '.ts',
				name: 'route',
			}),
			options: {
				oldPath: path,
				oldData,
			}
		}];
	},
	handleData: async (api, path, data, options) => {

		const project = new tsmorph.Project({
			useInMemoryFileSystem: true,
			skipFileDependencyResolution: true,
			compilerOptions: {
				allowJs: true,
			},
		});

		const sourceFile = project.createSourceFile(
			options.oldPath ?? '',
			options.oldData,
		);

		return {
			kind: 'upsertData',
			path,
			data: sourceFile.print(),
		};
	},
};
