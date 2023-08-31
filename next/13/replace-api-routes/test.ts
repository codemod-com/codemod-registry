import { Context } from 'mocha';
import { DirectoryJSON, Volume, createFsFromVolume } from 'memfs';
import {
	FileSystemManager,
	UnifiedFileSystem,
	buildApi,
	executeRepomod,
} from '@intuita-inc/repomod-engine-api';
import { repomod } from './index.js';
import tsmorph from 'ts-morph';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toMarkdown } from 'mdast-util-to-markdown';
import { mdxjs } from 'micromark-extension-mdxjs';
import { mdxFromMarkdown, mdxToMarkdown } from 'mdast-util-mdx';
import { visit } from 'unist-util-visit';
import { deepStrictEqual } from 'node:assert';

const transform = async (json: DirectoryJSON) => {
	const volume = Volume.fromJSON(json);

	const fileSystemManager = new FileSystemManager(
		volume.promises.readdir as any,
		volume.promises.readFile as any,
		volume.promises.stat as any,
	);

	const fileSystem = createFsFromVolume(volume) as any;

	const unifiedFileSystem = new UnifiedFileSystem(
		fileSystem,
		fileSystemManager,
	);

	const parseMdx = (data: string) =>
		fromMarkdown(data, {
			extensions: [mdxjs()],
			mdastExtensions: [mdxFromMarkdown()],
		});

	type Root = ReturnType<typeof fromMarkdown>;

	const stringifyMdx = (tree: Root) =>
		toMarkdown(tree, { extensions: [mdxToMarkdown()] });

	const api = buildApi<{
		tsmorph: typeof tsmorph;
		parseMdx: typeof parseMdx;
		stringifyMdx: typeof stringifyMdx;
		visitMdxAst: typeof visit;
		unifiedFileSystem: UnifiedFileSystem;
	}>(unifiedFileSystem, () => ({
		tsmorph,
		parseMdx,
		stringifyMdx,
		visitMdxAst: visit,
		unifiedFileSystem,
	}));

	return executeRepomod(api, repomod, '/', {});
};

describe.only('next 13 replace-API-routes', function () {
	it('should find and extract code blocks related to HTTP method', async function (this: Context) {
		const A_CONTENT = `
		import type { NextApiRequest, NextApiResponse } from 'next'
 
		export default function handler(req: NextApiRequest, res: NextApiResponse) {
			if (req.method === 'POST') {
				res.status(200).json({ message: 'Hello from Next.js!' })
			} 
		}
	`;

		const [command] = await transform({
			'/opt/project/pages/api/hello.ts': A_CONTENT,
		});

		const expectedResult = `import { NextResponse } from 'next/server'
 
		export async function POST() {
			return NextResponse.json({ message: 'Hello from Next.js!' })
		}`;

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/app/api/hello/route.ts');

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			expectedResult.replace(/\W/gm, ''),
		);
	});
});
