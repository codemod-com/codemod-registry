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

		const [command] = await transform({
			'/opt/project/pages/a/index.tsx': A_CONTENT,
			'/opt/project/components/a.tsx': A_COMPONENT_CONTENT,
			'/opt/project/components/b.tsx': B_COMPONENT_CONTENT,
		});

		const expectedResult = `import { Metadata } from "next";
		import Meta from '../../components/a.tsx';
		export const metadata: Metadata = {
				title: \`title\`,
				description: "description",
		};
		export default function Page() {
				return <Meta />;
		}`;

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/a/index.tsx');

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			expectedResult.replace(/\W/gm, ''),
		);
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

		const [command] = await transform({
			'/opt/project/pages/a/index.tsx': A_CONTENT,
			'/opt/project/components/a.tsx': A_COMPONENT_CONTENT,
			'/opt/project/utils/index.ts': '',
		});

		const expectedResult = `import { Metadata } from "next";
		import Meta from '../../components/a.tsx';
		const env = process.env.APP_NAME;
		const { obj: { d } } = { obj: { d: "d" } };
		function c() { return "c" };
		const b = () => "b";
		const a = "a";
		export const metadata: Metadata = {
				title: \`\${a + b() + c() + d + e + env}\`,
		};
		export default function Page() {
				return <Meta />;
		}`;

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/a/index.tsx');

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			expectedResult.replace(/\W/gm, ''),
		);
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

		const [command] = await transform({
			'/opt/project/pages/a/index.tsx': A_CONTENT,
			'/opt/project/components/a.tsx': A_COMPONENT_CONTENT,
			'/opt/project/utils/index.ts': '',
		});

		const expectedResult = `
			import { Metadata } from "next";
			import Meta from '../../components/a.tsx';
			import { a } from "../../../utils/index.ts";
			export const metadata: Metadata = {
					title: \`\${a}\`,
			};
			export default function Page() {
					return <Meta />;
			}
		`;

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/a/index.tsx');

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			expectedResult.replace(/\W/gm, ''),
		);
	});

	it('should find definitions of identifiers within function  params', async function (this: Context) {
		const A_CONTENT = `
		import Meta from '../../components/a.tsx';
		const title="title";
		
		export default function Page() {
			return <Meta title={title} description={description} />;
		}
`;

		const A_COMPONENT_CONTENT = `
		import Head from 'next/head';
		import NestedComponent from '../components/b';
		
		const a = "a";
		function b() { return "b" };
		const c = () => {};
		const { d } = { d: "d" };
		export default function Meta({ title }) {
			return (<>
			<Head>
				<title>{title}</title>
			</Head>
			<NestedComponent a={a} b={b} c={c} d={d} />
			</>)
		}
`;

		const B_COMPONENT_CONTENT = `
		import Head from 'next/head';
		
		export default function NestedComponent({ a, b, c, d }) {
			return <Head>
			<meta name="description" content={a + b + c + d} />
			</Head>
		}
		
		export default NestedComponent;
`;

		const [command] = await transform({
			'/opt/project/pages/a/index.tsx': A_CONTENT,
			'/opt/project/components/a.tsx': A_COMPONENT_CONTENT,
			'/opt/project/components/b.tsx': B_COMPONENT_CONTENT,
		});

		const expectedResult = `import { Metadata } from "next";
		import Meta from '../../components/a.tsx';
		const { d } = { d: "d" };
		const c = () => { };
		function b() { return "b"; }
		const a = "a";
		export const metadata: Metadata = {
				title: \`\${title}\`,
				description: a + b + c + d,
		};
		const title = "title";
		export default function Page() {
				return <Meta title={title} description={description}/>;
		}`;

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/a/index.tsx');

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			expectedResult.replace(/\W/gm, ''),
		);
	});

	it('should create variable declaration when prop value is jsxExpression', async function (this: Context) {
		const A_CONTENT = `
		import Meta from '../../components/a.tsx';
		
		export default function Page() {
			return <Meta />;
		}
`;

		const A_COMPONENT_CONTENT = `
		import Head from 'next/head';
		import NestedComponent from '../components/b';
		
		const a = "a";
		function b() { return "b" };
		
		export default function Meta({ title }) {
			return (<>
			<Head>
				<title>{title}</title>
			</Head>
			<NestedComponent jsxExprProp={a + b()} />
			</>)
		}
`;

		const B_COMPONENT_CONTENT = `
		import Head from 'next/head';
		
		export default function NestedComponent({ jsxExprProp }) {
			return <Head>
			<meta name="description" content={jsxExprProp} />
			</Head>
		}
		
		export default NestedComponent;
`;

		const [command] = await transform({
			'/opt/project/pages/a/index.tsx': A_CONTENT,
			'/opt/project/components/a.tsx': A_COMPONENT_CONTENT,
			'/opt/project/components/b.tsx': B_COMPONENT_CONTENT,
		});

		// @TODO order
		const expectedResult = `import { Metadata } from "next";
		import Meta from '../../components/a.tsx';
		const jsxExprProp = a + b();
		function b() { return "b"; }
		const a = "a";
		export const metadata: Metadata = {
				title: \`\${title}\`,
				description: jsxExprProp,
		};
		export default function Page() {
				return <Meta />;
		}`;

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/a/index.tsx');
		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			expectedResult.replace(/\W/gm, ''),
		);
	});

	it('should create generateMetadata function if Page props referenced in child metadata', async function (this: Context) {
		const A_CONTENT = `
		import Meta from '../../components/a.tsx';
		
		export default function Page({ title, description }) {
			return <Meta title={title} description={description} />;
		}
`;

		const A_COMPONENT_CONTENT = `
		import Head from 'next/head';
		import NestedComponent from '../components/b';
		export default function Meta({ title, description }) {
			return (<>
			<Head>
				<title>{title}</title>
				<meta name="description" content={description} />
			</Head>
			<NestedComponent appName={"appName"} />
			</>)
		}
`;

		const B_COMPONENT_CONTENT = `
			import Head from 'next/head';
				
			export default function NestedComponent({ appName }) {
				return <Head>
				<meta name="application-name" content={appName} />
				</Head>
			}
			
			export default NestedComponent;
`;

		const [command] = await transform({
			'/opt/project/pages/a/index.tsx': A_CONTENT,
			'/opt/project/components/a.tsx': A_COMPONENT_CONTENT,
			'/opt/project/components/b.tsx': B_COMPONENT_CONTENT,
		});

		const expectedResult = `
		import { Metadata } from "next";
		import Meta from '../../components/a.tsx';
		const appName = "appName";
		export default function Page({ title, description }) {
				return <Meta title={title} description={description}/>;
		}
		export async function generateMetadata({ params }: {
			params: Record<string, any>;
		}): Promise<Metadata> {
				const getStaticPropsResult = await getStaticProps({ params });
				if (!('props' in getStaticPropsResult)) {
						return {};
				}
				const { title, description } = getStaticPropsResult.props;
				return {
						title: \`\${title}\`,
						description: description,
						applicationName: appName,
				};
}`;

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/a/index.tsx');

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			expectedResult.replace(/\W/gm, ''),
		);
	});

	it('should copy the clause import, not the variable definition', async function (this: Context) {
		const INDEX_DATA = `
			import Head from 'next/head';
			import { A } from '../lib/a';
			
			export default function Index() {
				return <div>
					<Head>
						<title>{\`Title: \${A}\`}</title>
					</Head>
				</div>;
			}
		`;

		const A_DATA = `
			export const A = 'test';
		`;

		const [command] = await transform({
			'/opt/project/pages/index.tsx': INDEX_DATA,
			'/opt/project/lib/a.tsx': A_DATA,
		});

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/index.tsx');

		const NEW_DATA = `
			import { Metadata } from "next";
			import Head from 'next/head';

			import { A } from '../lib/a';

			export const metadata: Metadata = {
				title: \`Title: \${A}\`,
			};

			export default function Index() {
				return <div>
					<Head>
						<title>{\`Title: \${A}\`}</title>
					</Head>
				</div>;
			};
		`;

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			NEW_DATA.replace(/\W/gm, ''),
		);
	});

	it('should copy the default import, not the variable definition', async function (this: Context) {
		const INDEX_DATA = `
			import Head from 'next/head';
			import A from '../lib/a';
			
			export default function Index() {
				return <div>
					<Head>
						<title>{\`Title: \${A}\`}</title>
					</Head>
				</div>;
			}
		`;

		const A_DATA = `
			export default const A = 'test';
		`;

		const [command] = await transform({
			'/opt/project/pages/index.tsx': INDEX_DATA,
			'/opt/project/lib/a.tsx': A_DATA,
		});

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/index.tsx');

		const NEW_DATA = `
			import { Metadata } from "next";
			import Head from 'next/head';

			import A from '../lib/a';

			export const metadata: Metadata = {
				title: \`Title: \${A}\`,
			};

			export default function Index() {
				return <div>
					<Head>
						<title>{\`Title: \${A}\`}</title>
					</Head>
				</div>;
			};
		`;

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			NEW_DATA.replace(/\W/gm, ''),
		);
	});
});
