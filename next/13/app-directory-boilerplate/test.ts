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

const INDEX_CONTENT = `
import A from './testQWE';

export default function Index({}) {
	return null;
}
  
export const getStaticProps = async ({}) => {
	return {
		props: {},
	  	revalidate: 10,
	}
}
`;

const A_B_CONTENT = `
import { X } from "../../testABC";
import { Y } from "./testDEF";

export const getStaticPath = () => {

}
`;

const A_C_CONTENT = `
export const getServerSideProps = () => {

}
`;

const transform = async (json: DirectoryJSON) => {
	const volume = Volume.fromJSON(json);

	const fileSystemManager = new FileSystemManager(
		volume.promises.readdir as any,
		volume.promises.readFile as any,
		volume.promises.stat as any,
	);
	const unifiedFileSystem = new UnifiedFileSystem(
		createFsFromVolume(volume) as any,
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
	}>(unifiedFileSystem, () => ({
		tsmorph,
		parseMdx,
		stringifyMdx,
		visitMdxAst: visit,
	}));

	return executeRepomod(api, repomod, '/', {});
};

const A_B_DATA = `// This file has been sourced from: /opt/project/pages/[a]/[b].tsx
import { X } from "../../../testABC";
import { Y } from "../testDEF";
// TODO reimplement getStaticPath as generateStaticParams
export const getStaticPath = () => {
};
`;

const A_B_MDX_DATA = `// This file has been sourced from: /opt/project/pages/[a]/[b].mdx
import { X } from "../../../testABC";
import { Y } from "../testDEF";


// TODO reimplement getStaticPath as generateStaticParams
export const getStaticPath = () => {
};
`;

const A_C_DATA = `// This file has been sourced from: /opt/project/pages/[a]/c.tsx
// TODO reimplement getServerSideProps with custom logic
export const getServerSideProps = () => {
};
`;

const A_C_MDX_DATA = `// This file has been sourced from: /opt/project/pages/[a]/c.mdx
// TODO reimplement getServerSideProps with custom logic
export const getServerSideProps = () => {
};
`;

describe('next 13 app-directory-boilerplate', function () {
	it('should build correct files', async function (this: Context) {
		const externalFileCommands = await transform({
			'/opt/project/pages/index.jsx': INDEX_CONTENT,
			'/opt/project/pages/_app.jsx': '',
			'/opt/project/pages/_document.jsx': '',
			'/opt/project/pages/_error.jsx': '',
			'/opt/project/pages/_404.jsx': '',
			'/opt/project/pages/[a]/[b].tsx': A_B_CONTENT,
			'/opt/project/pages/[a]/c.tsx': A_C_CONTENT,
			'/opt/project/pages/a/index.tsx': '',
		});

		deepStrictEqual(externalFileCommands.length, 8);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/layout.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/error.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/not-found.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/page.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) =>
					command.path === '/opt/project/app/[a]/[b]/page.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/[a]/c/page.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/a/page.tsx',
			),
		);

		deepStrictEqual(externalFileCommands[1], {
			kind: 'upsertFile',
			path: '/opt/project/app/page.tsx',
			data: '// This file has been sourced from: /opt/project/pages/index.jsx\nimport A from "./testQWE";\nexport default function Index({}) {\n    return null;\n}\nexport const getStaticProps = async ({}) => {\n    return {\n        props: {},\n        revalidate: 10,\n    };\n};\n',
		});

		deepStrictEqual(externalFileCommands[6], {
			kind: 'upsertFile',
			path: '/opt/project/app/[a]/c/page.tsx',
			data: A_C_DATA,
		});

		deepStrictEqual(externalFileCommands[7], {
			kind: 'upsertFile',
			path: '/opt/project/app/[a]/[b]/page.tsx',
			data: A_B_DATA,
		});
	});

	it('should build neither error files nor not-found files if no such previous files were found', async function (this: Context) {
		const externalFileCommands = await transform({
			'/opt/project/pages/index.jsx': '',
			'/opt/project/pages/_app.jsx': '',
			'/opt/project/pages/_document.jsx': '',
		});

		deepStrictEqual(externalFileCommands.length, 3);

		ok(
			!externalFileCommands.some(
				(command) => command.path === '/opt/project/app/error.tsx',
			),
		);

		ok(
			!externalFileCommands.some(
				(command) => command.path === '/opt/project/app/error.jsx',
			),
		);

		ok(
			!externalFileCommands.some(
				(command) => command.path === '/opt/project/app/not-found.tsx',
			),
		);

		ok(
			!externalFileCommands.some(
				(command) => command.path === '/opt/project/app/not-found.jsx',
			),
		);
	});

	it('should build correct MDX files', async function (this: Context) {
		const externalFileCommands = await transform({
			'/opt/project/pages/index.jsx': INDEX_CONTENT,
			'/opt/project/pages/_app.jsx': '',
			'/opt/project/pages/_document.jsx': '',
			'/opt/project/pages/[a]/[b].mdx': A_B_CONTENT,
			'/opt/project/pages/[a]/c.mdx': A_C_CONTENT,
		});

		deepStrictEqual(externalFileCommands.length, 5);

		deepStrictEqual(externalFileCommands[3], {
			kind: 'upsertFile',
			path: '/opt/project/app/[a]/c/page.mdx',
			data: A_C_MDX_DATA,
		});

		deepStrictEqual(externalFileCommands[4], {
			kind: 'upsertFile',
			path: '/opt/project/app/[a]/[b]/page.mdx',
			data: A_B_MDX_DATA,
		});
	});

	it('should remove the Head tag', async function (this: Context) {
		const content = `
		import Head from 'next/head';

		export default async function Index() {
			return <div>
				<Head></Head>
			</div>;
		}
		`;

		const newContent = `
		// This file has been sourced from: /opt/project/pages/index.jsx

		export default async function Index() {
			return <div>
			</div>;
		}
		`;

		const [, upsertFileCommand, deleteIndexJsxCommand] = await transform({
			'/opt/project/pages/index.jsx': content,
		});

		deepStrictEqual(upsertFileCommand?.kind, 'upsertFile');
		deepStrictEqual(upsertFileCommand?.path, '/opt/project/app/page.tsx');

		deepStrictEqual(
			upsertFileCommand?.data.replace(/\W/gm, ''),
			newContent.replace(/\W/gm, ''),
		);

		deepStrictEqual(deleteIndexJsxCommand?.kind, 'deleteFile');
		deepStrictEqual(
			deleteIndexJsxCommand?.path,
			'/opt/project/pages/index.jsx',
		);
	});

	it('should remove the Head tag when surrounded with ()', async function (this: Context) {
		const content = `
		import Head from "next/head";

		export default function Index() {
			return (
				<Head></Head>
			);
		}
		`;

		const newContent = `
		// This file has been sourced from: /opt/project/pages/index.jsx

		export default function Index() {
			return null;
		}
		`;

		const [, upsertFileCommand, deleteIndexJsxCommand] = await transform({
			'/opt/project/pages/index.jsx': content,
		});

		deepStrictEqual(upsertFileCommand?.kind, 'upsertFile');
		deepStrictEqual(upsertFileCommand?.path, '/opt/project/app/page.tsx');

		deepStrictEqual(
			upsertFileCommand?.data.replace(/\W/gm, ''),
			newContent.replace(/\W/gm, ''),
		);

		deepStrictEqual(deleteIndexJsxCommand?.kind, 'deleteFile');
		deepStrictEqual(
			deleteIndexJsxCommand?.path,
			'/opt/project/pages/index.jsx',
		);
	});
});
