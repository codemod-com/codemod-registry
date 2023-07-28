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

const A_CONTENT = `
import Meta from '../../components/a.tsx';
const global = "global";
export default function Index({}) {
	return <Meta title={"string"} description={global}/>;
}
`;

const A_COMPONENT_CONTENT = `
import Head from 'next/head';
import NestedComponent from '../components/b.tsx';
import notAComponent from '../utils';
notAComponent();
export default function Meta({ title, description }) {
	notAComponent();
	return (<>
	<Head>
		<title>{title}</title>
	</Head>
	<NestedComponent desc={description} />
	</>)
}

`;

const B_COMPONENT_CONTENT = `
import Head from 'next/head';

export default function NestedComponent({ description }) {
	return <Head>
	<meta name="description" content={description} />
	</Head>
}

export default NestedComponent;
`;

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

describe('next 13 replace-next-head-v2', function () {
	it('should merge inject metadata to the page', async function (this: Context) {
		const externalFileCommands = await transform({
			'/opt/project/pages/a/index.tsx': A_CONTENT,
			'/opt/project/components/a.tsx': A_COMPONENT_CONTENT,
			'/opt/project/components/b.tsx': B_COMPONENT_CONTENT,
		});

		deepStrictEqual(externalFileCommands[0], {
			kind: 'upsertFile',
			path: '/opt/project/pages/a/index.tsx',
			data:
				'import { Metadata } from "next";\n' +
				"import Meta from '../../components/a.tsx';\n" +
				'export const metadata: Metadata = {\n' +
				'    title: `${title}`,\n' +
				'    description: description,\n' +
				'};\n' +
				'const global = "global";\n' +
				'export default function Index({}) {\n' +
				'    return <Meta title={"string"} description={global}/>;\n' +
				'}\n',
		});
	});
});
