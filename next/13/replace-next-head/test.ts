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

describe('next 13 replace-next-head', function () {
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

	it('should respect tsconfig.json paths', async function (this: Context) {
		const A_CONTENT = `
		import Meta from '#/components/a.tsx';
		export default function Page() {
			return <Meta />;
		}
`;

		const A_COMPONENT_CONTENT = `
		import Head from 'next/head';
		export default function Meta() {
			return (
			<Head>
				<title>title</title>
			</Head>
			)
		}
`;

		const TSCONFIG_CONTENT = `
		{
			"compilerOptions": {
				"paths": {
					"#/components/*": ["./components/*"]
				}
			}
		}
`;

		const [command] = await transform({
			'/opt/project/pages/a/index.tsx': A_CONTENT,
			'/opt/project/components/a.tsx': A_COMPONENT_CONTENT,
			'/opt/project/tsconfig.json': TSCONFIG_CONTENT,
		});

		const expectedResult = `import { Metadata } from "next";
		import Meta from '#/components/a.tsx';
		export const metadata: Metadata = {
				title: \`title\`,
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

	it('should move definitions of identifiers used in meta tag expr to the Page file: recursive dependencies', async function (this: Context) {
		const A_CONTENT = `
		import Meta from '../../components/a.tsx';
		export default function Page() {
			return <Meta />;
		}
`;

		const A_COMPONENT_CONTENT = `
		import Head from 'next/head';
		
		const c = { d: { k: "a" }};
		const b = function() { return c };
		const a = "a" + b;

		export default function Meta() {
			return (
			<Head>
				<title>{a}</title>
			</Head>
			)
		}
`;

		const [command] = await transform({
			'/opt/project/pages/a/index.tsx': A_CONTENT,
			'/opt/project/components/a.tsx': A_COMPONENT_CONTENT,
			'/opt/project/utils/index.ts': '',
		});

		const expectedResult = `import { Metadata } from "next";
		import Meta from '../../components/a.tsx';
		const c = { d: { k: "a" }};
		const b = function() { return c };
		const a = "a" + b;

		
		export const metadata: Metadata = {
				title: \`\${a}\`,
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
				params: Record<string, string | string[]>;
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

	it('should insert generateMetadata function if metadata tags depend on component props', async function (this: Context) {
		const INDEX_DATA = `
		import Head from 'next/head';

		export default function Page({ a }) {
		   return (
		      <Head>
		        <title>{a.b}</title>
		      </Head>
		   );
		 }
		`;

		const [command] = await transform({
			'/opt/project/pages/index.tsx': INDEX_DATA,
		});

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/index.tsx');

		const NEW_DATA = `
		import { Metadata } from "next";
		import Head from 'next/head';

	  export default function Page({ a }) {
	    return (
	        <Head>
						<title>{a.b}</title>
	        </Head>
	    );
	  }
		
		export async function generateMetadata({ params }: {
			params: Record<string, string | string[]>;
	}): Promise<Metadata> {
			const getStaticPropsResult = await getStaticProps({ params });
			if (!('props' in getStaticPropsResult)) {
					return {};
			}
			const { a } = getStaticPropsResult.props;
			return {
					title: \`\${a.b}\`,
			};
	}
		`;

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			NEW_DATA.replace(/\W/gm, ''),
		);
	});

	it('should not remove JSX comments', async function (this: Context) {
		const INDEX_DATA = `
		import Head from 'next/head';
	  export default function Page() {
	    return (
	      <>
	        <Head>
	          <title>a</title>
						{/* A JSX comment */}
	        </Head>
	      </>
	    );
	  }
		`;

		const [command] = await transform({
			'/opt/project/pages/index.tsx': INDEX_DATA,
		});

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/index.tsx');

		const NEW_DATA = `
		import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			title: \`a\`,
		};
	  export default function Page() {
	    return (
	      <>
	        <Head>
	          <title>a</title>
						{/* A JSX comment */}
	        </Head>
	      </>
	    );
	  }
		`;

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			NEW_DATA.replace(/\W/gm, ''),
		);
	});

	it('should replace meta tags content: support link, meta and title tags', async function (this: Context) {
		const INDEX_DATA = `
		import Head from 'next/head';
		
	  export default function Page() {
	    return (
	        <Head>
	          <title>a</title>
						<meta name="description" content="a" />
						<link
							rel="icon"
							href="a"
						/>
	        </Head>
	    );
	  }
		`;

		const [command] = await transform({
			'/opt/project/pages/index.tsx': INDEX_DATA,
		});

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/index.tsx');

		const NEW_DATA = `
		import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			title: \`a\`,
			description: "a", 
			icons: {
				icon: [
					{ url: "a" }
				],
			}, 
		};
		
	  export default function Page() {
	    return (
	        <Head>
	        	<title>a</title>
						<meta name="description" content="a" />
						<link
							rel="icon"
							href="a"
						/>
	        </Head>
	    );
	  }
		`;

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			NEW_DATA.replace(/\W/gm, ''),
		);
	});

	it('should replace meta tags content: support conditionally rendered meta tags', async function (this: Context) {
		const INDEX_DATA = `
		import Head from 'next/head';
		
		const condition = true;
		
	  export default function Page() {
	    return (
	        <Head>
	          { condition && 	<meta name="description" content="a" /> }
	        </Head>
	    );
	  }
		`;

		const [command] = await transform({
			'/opt/project/pages/index.tsx': INDEX_DATA,
		});

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/index.tsx');

		const NEW_DATA = `
		import { Metadata } from "next";
		import Head from 'next/head';
		
		export const metadata: Metadata = {
			 description: "a"
		};
		
		const condition = true;
	  export default function Page() {
	    return (
	        <Head>
					{ condition && 	<meta name="description" content="a" /> }
	        </Head>
	    );
	  }
		`;

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			NEW_DATA.replace(/\W/gm, ''),
		);
	});

	it('should replace meta tag content: tag content can be a JSXText', async function (this: Context) {
		const INDEX_DATA = `
		import Head from 'next/head';
	  export default function Page() {
	    return (
	      <>
	        <Head>
	          <title>a</title>
	        </Head>
	      </>
	    );
	  }
		`;

		const [command] = await transform({
			'/opt/project/pages/index.tsx': INDEX_DATA,
		});

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/index.tsx');

		const NEW_DATA = `
		import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			title: \`a\`,
		};
	  export default function Page() {
	    return (
	      <>
	        <Head>
	          <title>a</title>
	        </Head>
	      </>
	    );
	  }
		`;

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			NEW_DATA.replace(/\W/gm, ''),
		);
	});

	it('should replace meta tag content: tag content can be a jsxExpression', async function (this: Context) {
		const INDEX_DATA = `
		import { Metadata } from "next";
	  import Head from 'next/head';
	  export default function Page() {
	    return (
	      <Head>
					<title>a {b() + c.d} {\`\${e}\`} {f ? g : h}</title>
	      </Head>
	    );
	  }
		`;

		const [command] = await transform({
			'/opt/project/pages/index.tsx': INDEX_DATA,
		});

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/index.tsx');

		const NEW_DATA = `
		import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			title: \`a \${b() + c.d} \${e}\ \${f ? g : h}\`
		};
	  export default function Page() {
	    return (
	        <Head>
					<title>a {b() + c.d} {\`\${e}\`} {f ? g : h}</title>
	        </Head>
	    );
	  }
		`;

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			NEW_DATA.replace(/\W/gm, ''),
		);
	});

	it('should replace meta tag content: tag content can be a StringLiteral', async function (this: Context) {
		const INDEX_DATA = `
		import Head from 'next/head';
	  export default function Page() {
	    return (
	        <Head>
						<meta name="viewport" content="a" />
	        </Head>
	    );
	  }
		`;

		const [command] = await transform({
			'/opt/project/pages/index.tsx': INDEX_DATA,
		});

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/index.tsx');

		const NEW_DATA = `
		import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			viewport: "a",
		};
		export default function Page() {
	    return (
	        <Head>
	            <meta name="viewport" content="a" />
	        </Head>
	    );
	  }
		`;

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			NEW_DATA.replace(/\W/gm, ''),
		);
	});

	/**
	 * Alternates
	 */

	it('should support alternates meta tags', async function (this: Context) {
		const INDEX_DATA = `
		import Head from 'next/head';
	  export default function Page() {
	    return (
	      <>
	        <Head>
						<link rel="canonical" href="https://nextjs.org" />
						<link rel="alternate" hreflang="en-US" href="https://nextjs.org/en-US" />
						<link rel="alternate" hreflang="de-DE" href="https://nextjs.org/de-DE" />
						<link
							rel="alternate"
							media="only screen and (max-width: 600px)"
							href="https://nextjs.org/mobile"
						/>
						<link
							rel="alternate"
							type="application/rss+xml"
							href="https://nextjs.org/rss"
						/>
	        </Head>
	      </>
	    );
	  }
		`;

		const [command] = await transform({
			'/opt/project/pages/index.tsx': INDEX_DATA,
		});

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/index.tsx');

		const NEW_DATA = `
		import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			alternates: {
				canonical: "https://nextjs.org",
				languages: {
					"en-US": "https://nextjs.org/en-US",
					"de-DE": "https://nextjs.org/de-DE",
				},
				media: {
					"only screen and (max-width: 600px)": "https://nextjs.org/mobile",
				},
				types: {
					"application/rss+xml": "https://nextjs.org/rss",
				},
			},
		};

		export default function Page() {
	    return (
	      <>
	        <Head>
	            <link rel="canonical" href="https://nextjs.org" />
	            <link rel="alternate" hreflang="en-US" href="https://nextjs.org/en-US" />
	            <link rel="alternate" hreflang="de-DE" href="https://nextjs.org/de-DE" />
	            <link
								rel="alternate"
								media="only screen and (max-width: 600px)"
								href="https://nextjs.org/mobile"
							/>
	            <link
								rel="alternate"
								type="application/rss+xml"
								href="https://nextjs.org/rss"
							/>
	        </Head>
	      </>
	    );
	  }
		`;

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			NEW_DATA.replace(/\W/gm, ''),
		);
	});

	/**
	 * Icons
	 */

	it('should support icons meta tags', async function (this: Context) {
		const INDEX_DATA = `
		import Head from 'next/head';
	  export default function Page() {
	    return (
	      <>
	        <Head>
						<link rel="shortcut icon" href="/shortcut-icon.png" />
						<link
							rel="apple-touch-icon"
							sizes="180x180"
							href="/favicon/apple-touch-icon.png"
						/>
						<link
							rel="icon"
							type="image/png"
							sizes="32x32"
							href="/favicon/favicon-32x32.png"
						/>
						<link
							rel="icon"
							type="image/png"
							sizes="16x16"
							href="/favicon/favicon-16x16.png"
						/>
						<link
							rel="mask-icon"
							href="/favicon/safari-pinned-tab.svg"
							color="#000000"
						/>
	        </Head>
	      </>
	    );
	  }
		`;

		const [command] = await transform({
			'/opt/project/pages/index.tsx': INDEX_DATA,
		});

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/index.tsx');

		const NEW_DATA = `
		import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			icons: {
				shortcut: [{ url: "/shortcut-icon.png", }],
				apple: [{ sizes: "180x180", url: "/favicon/apple-touch-icon.png", }],
				icon: [
					{ sizes: "32x32", type: "image/png", url: "/favicon/favicon-32x32.png", },
					{
						sizes: "16x16",
						type: "image/png",
						url: "/favicon/favicon-16x16.png",
					}
				],
				other: [
					{
						url: "/favicon/safari-pinned-tab.svg",
						rel: "mask-icon",
					}
				],
			},
		};

		export default function Page() {
	    return (
	      <>
	        <Head>
						<link rel="shortcut icon" href="/shortcut-icon.png" />
						<link
						rel="apple-touch-icon"
						sizes="180x180"
						href="/favicon/apple-touch-icon.png"
						/>
						<link
							rel="icon"
							type="image/png"
							sizes="32x32"
							href="/favicon/favicon-32x32.png"
						/>
						<link
							rel="icon"
							type="image/png"
							sizes="16x16"
							href="/favicon/favicon-16x16.png"
						/>
						<link
						rel="mask-icon"
						href="/favicon/safari-pinned-tab.svg"
						color="#000000"
					/>
					</Head>
	      </>
	    );
	  }
		`;

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			NEW_DATA.replace(/\W/gm, ''),
		);
	});

	it('should support verification meta tags', async function (this: Context) {
		const INDEX_DATA = `
	  import Head from 'next/head';
	  export default function Page() {
	    return (
	      <>
	        <Head>
						<meta name="google-site-verification" content="google" />
						<meta name="yandex-verification" content="yandex" />
						<meta name="y_key" content="yahoo" />
	        </Head>
	      </>
	    );
	  }
		`;

		const [command] = await transform({
			'/opt/project/pages/index.tsx': INDEX_DATA,
		});

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/index.tsx');

		const NEW_DATA = `
		import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			verification: {
				google: "google",
				yandex: "yandex",
				yahoo: "yahoo",
			},
		};

		export default function Page() {
	    return (
	      <>
	        <Head>
						<meta name="google-site-verification" content="google" />
						<meta name="yandex-verification" content="yandex" />
						<meta name="y_key" content="yahoo" />
					</Head>
	      </>
	    );
	  }
		`;

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			NEW_DATA.replace(/\W/gm, ''),
		);
	});

	it('should support openGraph meta tags: website', async function (this: Context) {
		const INDEX_DATA = `
		import Head from 'next/head';
	  export default function Page() {
	    return (
	      <>
	        <Head>
						<meta property="og:determiner" content="the" />
						<meta property="og:title" content="Next.js" />
						<meta property="og:description" content="The React Framework for the Web" />
						<meta property="og:url" content="https://nextjs.org/" />
						<meta property="og:site_name" content="Next.js" />
						<meta property="og:locale" content="en_US" />
						<meta property="og:locale:alternate" content="fr_FR" />
						<meta property="og:locale:alternate" content="es_ES" />
						<meta property="og:type" content="website" />
						<meta property="og:image:url" content="https://nextjs.org/og.png" />
						<meta property="og:image:width" content="800" />
						<meta property="og:image:height" content="600" />
						<meta property="og:image:url" content="https://nextjs.org/og-alt.png" />
						<meta property="og:image:width" content="1800" />
						<meta property="og:image:height" content="1600" />
						<meta property="og:image:alt" content="My custom alt" />
						<meta property="og:audio" content="https://example.com/sound.mp3" />
						<meta property="og:audio:secure_url" content="https://secure.example.com/sound.mp3" />
						<meta property="og:audio:type" content="audio/mpeg" />
						<meta property="og:video" content="https://example.com/movie.swf" />
						<meta property="og:video:secure_url" content="https://secure.example.com/movie.swf" />
						<meta property="og:video:type" content="application/x-shockwave-flash" />
						<meta property="og:video:width" content="400" />
						<meta property="og:video:height" content="300" />
	        </Head>
	      </>
	    );
	  }
		`;

		const [command] = await transform({
			'/opt/project/pages/index.tsx': INDEX_DATA,
		});

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/index.tsx');

		const NEW_DATA = `
		import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			openGraph: {
				determiner: "the",
				title: "Next.js",
				description: "The React Framework for the Web",
				url: "https://nextjs.org/",
				siteName: "Next.js",
				locale: "en_US",
				alternateLocale: ["fr_FR", "es_ES"],
				type: "website",
				images: [{
					url: "https://nextjs.org/og.png",
					width: "800",
					height: "600",
				}, {
						url: "https://nextjs.org/og-alt.png",
						width: "1800",
						height: "1600",
						alt: "My custom alt",
				}],
				audio: [{
					url: "https://example.com/sound.mp3",
					secureUrl: "https://secure.example.com/sound.mp3",
					type: "audio/mpeg",
				}],
				videos: [{
					url: "https://example.com/movie.swf",
					secureUrl: "https://secure.example.com/movie.swf",
					type: "application/x-shockwave-flash",
					width: "400",
					height: "300",
				}],
			},
		};

		export default function Page() {
	    return (
	      <>
	        <Head>
						<meta property="og:determiner" content="the" />
						<meta property="og:title" content="Next.js" />
						<meta property="og:description" content="The React Framework for the Web" />
						<meta property="og:url" content="https://nextjs.org/" />
						<meta property="og:site_name" content="Next.js" />
						<meta property="og:locale" content="en_US" />
						<meta property="og:locale:alternate" content="fr_FR" />
						<meta property="og:locale:alternate" content="es_ES" />
						<meta property="og:type" content="website" />
						<meta property="og:image:url" content="https://nextjs.org/og.png" />
						<meta property="og:image:width" content="800" />
						<meta property="og:image:height" content="600" />
						<meta property="og:image:url" content="https://nextjs.org/og-alt.png" />
						<meta property="og:image:width" content="1800" />
						<meta property="og:image:height" content="1600" />
						<meta property="og:image:alt" content="My custom alt" />
						<meta property="og:audio" content="https://example.com/sound.mp3" />
						<meta property="og:audio:secure_url" content="https://secure.example.com/sound.mp3" />
						<meta property="og:audio:type" content="audio/mpeg" />
						<meta property="og:video" content="https://example.com/movie.swf" />
						<meta property="og:video:secure_url" content="https://secure.example.com/movie.swf" />
						<meta property="og:video:type" content="application/x-shockwave-flash" />
						<meta property="og:video:width" content="400" />
						<meta property="og:video:height" content="300" />
					</Head>
	      </>
	    );
	  }
		`;

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			NEW_DATA.replace(/\W/gm, ''),
		);
	});

	it('should support openGraph meta tags: article', async function (this: Context) {
		const INDEX_DATA = `
		import Head from 'next/head';
	  export default function Page() {
	    return (
	      <>
	        <Head>
						<meta property="og:type" content="article" />
						<meta property="article:published_time" content="2023-07-20T12:24:36.871Z" />
						<meta property="article:modified_time" content="2023-07-20T12:24:36.871Z" />
						<meta property="article:expiration_time" content="2023-07-20T12:24:36.871Z" />
						<meta property="article:author" content="Seb" />
						<meta property="article:author" content="Josh" />
						<meta property="article:section" content="Technology" />
						<meta property="article:tag" content="tag1" />
						<meta property="article:tag" content="tag2" />
	        </Head>
	      </>
	    );
	  }
		`;

		const [command] = await transform({
			'/opt/project/pages/index.tsx': INDEX_DATA,
		});

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/index.tsx');

		const NEW_DATA = `
		import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			openGraph: {
				type: "article",
				publishedTime: "2023-07-20T12:24:36.871Z",
				modifiedTime: "2023-07-20T12:24:36.871Z",
				expirationTime: "2023-07-20T12:24:36.871Z",
				authors: ["Seb", "Josh"],
				section: "Technology",
				tags: ["tag1", "tag2"],
			},
		};

		export default function Page() {
	    return (
	      <>
	        <Head>
						<meta property="og:type" content="article" />
						<meta property="article:published_time" content="2023-07-20T12:24:36.871Z" />
						<meta property="article:modified_time" content="2023-07-20T12:24:36.871Z" />
						<meta property="article:expiration_time" content="2023-07-20T12:24:36.871Z" />
						<meta property="article:author" content="Seb" />
						<meta property="article:author" content="Josh" />
						<meta property="article:section" content="Technology" />
						<meta property="article:tag" content="tag1" />
						<meta property="article:tag" content="tag2" />
					</Head>
	      </>
	    );
	  }
		`;

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			NEW_DATA.replace(/\W/gm, ''),
		);
	});

	it('should support openGraph meta tags: twitter', async function (this: Context) {
		const INDEX_DATA = `
		import Head from 'next/head';
	  export default function Page() {
	    return (
	        <Head>
						<meta name="twitter:card" content="summary_large_image" />
						<meta name="twitter:title" content="Next.js" />
						<meta name="twitter:description" content="The React Framework for the Web" />
						<meta name="twitter:site:id" content="1467726470533754880" />
						<meta name="twitter:creator" content="@nextjs" />
						<meta name="twitter:creator:id" content="1467726470533754880" />
	        </Head>
	    );
	  }
		`;

		const [command] = await transform({
			'/opt/project/pages/index.tsx': INDEX_DATA,
		});

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/index.tsx');

		const NEW_DATA = `
		import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			twitter: {
				card: "summary_large_image",
				title: "Next.js",
				description: "The React Framework for the Web",
				siteId: "1467726470533754880",
				creator: "@nextjs",
				creatorId: "1467726470533754880",
			},
		};

		export default function Page() {
	    return (
	      <>
	        <Head>
						<meta name="twitter:card" content="summary_large_image" />
						<meta name="twitter:title" content="Next.js" />
						<meta name="twitter:description" content="The React Framework for the Web" />
						<meta name="twitter:site:id" content="1467726470533754880" />
						<meta name="twitter:creator" content="@nextjs" />
						<meta name="twitter:creator:id" content="1467726470533754880" />
					</Head>
	      </>
	    );
	  }
		`;

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			NEW_DATA.replace(/\W/gm, ''),
		);
	});

	it('should support other meta tags', async function (this: Context) {
		const INDEX_DATA = `
		import Head from 'next/head';
	  export default function Page() {
	    return (
	        <Head>
						<meta name="msapplication-TileColor" content="#000000" />
						<meta name="msapplication-config" content="/favicon/browserconfig.xml" />
	        </Head>
	    );
	  }
		`;

		const [command] = await transform({
			'/opt/project/pages/index.tsx': INDEX_DATA,
		});

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/index.tsx');

		const NEW_DATA = `
		import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			other: {
				"msapplication-TileColor": "#000000",
				"msapplication-config": "/favicon/browserconfig.xml",
			},
		};

		export default function Page() {
	    return (
	        <Head>
						<meta name="msapplication-TileColor" content="#000000" />
						<meta name="msapplication-config" content="/favicon/browserconfig.xml" />
					</Head>
	    );
	  }
		`;

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			NEW_DATA.replace(/\W/gm, ''),
		);
	});

	it('should support basic meta tags', async function (this: Context) {
		const INDEX_DATA = `
		import Head from 'next/head';
	
	  export default function Page() {
	    return (
	        <Head>
							<title>a</title>
							<meta name="description" content="a" />
							<meta name="application-name" content="a"/>
							<meta name="author" content="a" />
							<link rel="author" href="a" />
							<meta name="author" content="a" />
							<link rel="manifest" href="a" />
							<meta name="generator" content="a" />
							<meta name="keywords" content="a" />
							<meta name="referrer" content="a" />
							<meta name="theme-color" media="(prefers-color-scheme: light)" content={var11} />
							<meta name="theme-color" media="(prefers-color-scheme: dark)" content={var12} />
							<meta name="theme-color" content="a" />
							<meta name="color-scheme" content="a" />
							<meta name="viewport" content="a" />
							<meta name="creator" content="a" />
							<meta name="publisher" content="a" />
							<meta name="robots" content="a" />
							<meta name="googlebot" content="a" />
							<meta name="abstract" content="a" />
							<link rel="archives" href="a" />
							<link rel="assets" href="a" />
							<link rel="bookmarks" href="a"/>
							<meta name="category" content="a" />
							<meta name="classification" content="a" />
	        </Head>
	    );
	  }
		`;

		const [command] = await transform({
			'/opt/project/pages/index.tsx': INDEX_DATA,
		});

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/pages/index.tsx');

		const NEW_DATA = `
		import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			title: "a",
			description: "a",
			applicationName: "a",
			authors:  [{ name: "a", url: "a", }, { name: "a", }],
			manifest: "a",
			generator: "a",
			keywords: "a",
			referrer: "a",
			themeColor: [
				{ media: "(prefers-color-scheme: light)", color: var11, },
				{ media: "(prefers-color-scheme: dark)", color: var12, },
				{ color: "a", }
			],
			colorScheme: "a",
			viewport: "a",
			creator: "a",
			publisher: "a",
			robots: "a",
			abstract: "a",
			archives: ["a"],
			assets: ["a"],
			bookmarks: ["a"],
			category: "a",
			classification: "a",
		};
		export default function Page() {
	    return (
	        <Head>
						<title>a</title>
						<meta name="description" content="a" />
						<meta name="application-name" content="a"/>
						<meta name="author" content="a" />
						<link rel="author" href="a" />
						<meta name="author" content="a" />
						<link rel="manifest" href="a" />
						<meta name="generator" content="a" />
						<meta name="keywords" content="a" />
						<meta name="referrer" content="a" />
						<meta name="theme-color" media="(prefers-color-scheme: light)" content={var11} />
						<meta name="theme-color" media="(prefers-color-scheme: dark)" content={var12} />
						<meta name="theme-color" content="a" />
						<meta name="color-scheme" content="a" />
						<meta name="viewport" content="a" />
						<meta name="creator" content="a" />
						<meta name="publisher" content="a" />
						<meta name="robots" content="a" />
						<meta name="googlebot" content="a" />
						<meta name="abstract" content="a" />
						<link rel="archives" href="a" />
						<link rel="assets" href="a" />
						<link rel="bookmarks" href="a"/>
						<meta name="category" content="a" />
						<meta name="classification" content="a" />
					</Head>
	    );
	  }
		`;

		deepStrictEqual(
			command.data.replace(/\W/gm, ''),
			NEW_DATA.replace(/\W/gm, ''),
		);
	});
});
