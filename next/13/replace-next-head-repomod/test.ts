import { Context } from 'mocha';
import { deepStrictEqual, ok } from 'node:assert';
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

const A_CONTENT = `
import Meta from '../../components/a.tsx';

export default function Index({}) {
	return <Meta />;
}
`;


const A_COMPONENT_CONTENT = `
import Head from 'next/head';

const Meta = () => {
	return <Head><title>title</title></Head>
}

export default Meta;
`

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
		unifiedFileSystem: UnifiedFileSystem, 
	}>(unifiedFileSystem, () => ({
		tsmorph,
		parseMdx,
		stringifyMdx,
		visitMdxAst: visit,
		unifiedFileSystem,
	}));

	return executeRepomod(api, repomod, '/', {});
};


describe('next 13 replace-next-head-repomod', function () {
	it('should build correct files', async function (this: Context) {
		const externalFileCommands = await transform({
			'/opt/project/pages/a/index.tsx': A_CONTENT,
			'/opt/project/components/a.tsx': A_COMPONENT_CONTENT, 
		});

	// 	deepStrictEqual(externalFileCommands.length, 7);

	// 	ok(
	// 		externalFileCommands.some(
	// 			(command) => command.path === '/opt/project/app/layout.tsx',
	// 		),
	// 	);

	// 	ok(
	// 		externalFileCommands.some(
	// 			(command) => command.path === '/opt/project/app/error.tsx',
	// 		),
	// 	);

	// 	ok(
	// 		externalFileCommands.some(
	// 			(command) => command.path === '/opt/project/app/not-found.tsx',
	// 		),
	// 	);

	// 	ok(
	// 		externalFileCommands.some(
	// 			(command) => command.path === '/opt/project/app/page.tsx',
	// 		),
	// 	);

	// 	ok(
	// 		externalFileCommands.some(
	// 			(command) =>
	// 				command.path === '/opt/project/app/[a]/[b]/page.tsx',
	// 		),
	// 	);

	// 	ok(
	// 		externalFileCommands.some(
	// 			(command) => command.path === '/opt/project/app/[a]/c/page.tsx',
	// 		),
	// 	);

	// 	ok(
	// 		externalFileCommands.some(
	// 			(command) => command.path === '/opt/project/app/a/page.tsx',
	// 		),
	// 	);

	// 	deepStrictEqual(externalFileCommands[1], {
	// 		kind: 'upsertFile',
	// 		path: '/opt/project/app/page.tsx',
	// 		data: '// This file has been sourced from: /opt/project/pages/index.jsx\nimport A from "./testQWE";\nexport default function Index({}) {\n    return null;\n}\nexport const getStaticProps = async ({}) => {\n    return {\n        props: {},\n        revalidate: 10,\n    };\n};\n',
	// 	});

	// 	deepStrictEqual(externalFileCommands[5], {
	// 		kind: 'upsertFile',
	// 		path: '/opt/project/app/[a]/c/page.tsx',
	// 		data: A_C_DATA,
	// 	});

	// 	deepStrictEqual(externalFileCommands[6], {
	// 		kind: 'upsertFile',
	// 		path: '/opt/project/app/[a]/[b]/page.tsx',
	// 		data: A_B_DATA,
	// 	});
	});
});
