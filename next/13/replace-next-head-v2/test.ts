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

describe('next 13 replace-next-head-v2', function () {
	it('should find and merge metadata in Page child components', async function (this: Context) {
		const A_CONTENT = `
		import Meta from '../../components/a.tsx';
		export default function Page() {
			return <Meta />;
		}
`;

		const A_COMPONENT_CONTENT = `
		import Head from 'next/head';
		import NestedComponent from '../components/b.tsx';
		export default function Meta() {
			return (<>
			<Head>
				<title>title</title>
			</Head>
			<NestedComponent />
			</>)
		}
`;

		const B_COMPONENT_CONTENT = `
		import Head from 'next/head';
			
		export default function NestedComponent() {
			return <Head>
			<meta name="description" content="description" />
			</Head>
		}
		
		export default NestedComponent;
`;

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
				'    title: `title`,\n' +
				'    description: "description",\n' +
				'};\n' +
				'export default function Page() {\n' +
				'    return <Meta />;\n' +
				'}\n',
		});
	});

	it('should move definitions of identifiers used in meta tag expr to the Page file', async function (this: Context) {
		const A_CONTENT = `
		import Meta from '../../components/a.tsx';
		export default function Page() {
			return <Meta />;
		}
`;

		const A_COMPONENT_CONTENT = `
		import Head from 'next/head';
		
		const a = "a";
		const b = () => "b";
		function c() { return "c" };
		const { obj: { d }} = { obj: { d: "d"} };
		const env = process.env.APP_NAME;
		
		export default function Meta() {
			return (<>
			<Head>
				<title>{a + b() + c() + d + e + env}</title>
			</Head>
			</>)
		}
`;

		const externalFileCommands = await transform({
			'/opt/project/pages/a/index.tsx': A_CONTENT,
			'/opt/project/components/a.tsx': A_COMPONENT_CONTENT,
			'/opt/project/utils/index.ts': '',
		});

		deepStrictEqual(externalFileCommands[0], {
			kind: 'upsertFile',
			path: '/opt/project/pages/a/index.tsx',
			data:
				'import { Metadata } from "next";\n' +
				"import Meta from '../../components/a.tsx';\n" +
				'const env = process.env.APP_NAME;\n' +
				'const { obj: { d } } = { obj: { d: "d" } };\n' +
				'const b = () => "b";\n' +
				'const a = "a";\n' +
				'export const metadata: Metadata = {\n' +
				'    title: `${a + b() + c() + d + e + env}`,\n' +
				'};\n' +
				'export default function Page() {\n' +
				'    return <Meta />;\n' +
				'}\n',
		});
	});

	it('should move identifier definitions that are ImportDeclarations, should update the moduleSpecifier when moved ', async function (this: Context) {
		const A_CONTENT = `
		import Meta from '../../components/a.tsx';
		export default function Page() {
			return <Meta />;
		}
`;

		const A_COMPONENT_CONTENT = `
		import Head from 'next/head';
		import { a } from '../utils';
		
		export default function Meta() {
			return (<>
			<Head>
				<title>{a}</title>
			</Head>
			</>)
		}
`;

		const externalFileCommands = await transform({
			'/opt/project/pages/a/index.tsx': A_CONTENT,
			'/opt/project/components/a.tsx': A_COMPONENT_CONTENT,
			'/opt/project/utils/index.ts': '',
		});

		deepStrictEqual(externalFileCommands[0], {
			kind: 'upsertFile',
			path: '/opt/project/pages/a/index.tsx',
			data:
				'import { Metadata } from "next";\n' +
				"import Meta from '../../components/a.tsx';\n" +
				'import { a } from "../../../utils/index.ts";\n' +
				'export const metadata: Metadata = {\n' +
				'    title: `${a}`,\n' +
				'};\n' +
				'export default function Page() {\n' +
				'    return <Meta />;\n' +
				'}\n',
		});
	});
});
