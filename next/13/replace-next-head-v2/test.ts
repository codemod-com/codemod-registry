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

	// it('should replace title tag - jsxText', function (this: Context) {
	// 	const beforeText = `
	//   import Head from 'next/head';
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	//           <title>My page title</title>
	//         </Head>
	//       </>
	//     );
	//   }
	// 	`;

	// 	const afterText = `
	//   import { Metadata } from "next";
	// 	import Head from 'next/head';
	//   export const metadata: Metadata = {
	// 		title: \`My page title\`,
	// 	};
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	//           {/* this tag can be removed */}
	//                  <title>My page title</title>
	//         </Head>
	//       </>
	//     );
	//   }
	//   `;

	// 	const { actual, expected } = transform(beforeText, afterText, '.tsx');
	// 	deepStrictEqual(
	// 		actual?.replace(/\s/gm, ''),
	// 		expected?.replace(/\s/gm, ''),
	// 	);
	// });

	// it('should insert generateMetadata function if metadata tags depend on component props', function (this: Context) {
	// 	const beforeText = `
	//   import Head from 'next/head';

	// 	export async function getStaticProps ({ params }) {
	// 		const { post, product } = fetchData(params.id);

	// 		return {
	// 			props: {
	// 				post,
	// 				product,
	// 			}
	// 		}
	// 	}

	//   export default function Page({ post, product }) {
	//     return (
	//       <>
	//         <Head>
	//           <title>{post.title}</title>
	// 					<meta name="description" content={product.details} />
	//         </Head>
	//       </>
	//     );
	//   }
	// 	`;

	// 	const afterText = `
	//   import { Metadata, ResolvingMetadata } from "next";
	// 	import Head from 'next/head';

	// 	type Params = Record<string, string |  string[]>;

	// 	export async function _getStaticProps ({ params }) {
	// 		const { post, product } = fetchData(params.id);

	// 		return {
	// 			props: {
	// 				post,
	// 				product,
	// 			}
	// 		}
	// 	}

	//   export default function Page({ post, product }) {
	//     return (
	//       <>
	//         <Head>
	//           {/* this tag can be removed */}
	// 					<title>{post.title}</title>
	// 					{/* this tag can be removed */}
	// 					<meta name="description" content={product.details} />
	//         </Head>
	//       </>
	//     );
	//   }
	// 	export async function generateMetadata(
	// 		{ params }: { params: Params },
	// 		parentMetadata: ResolvingMetadata
	// 	): Promise<Metadata> {
	// 		const { props }  = await _getStaticProps({ params });

	// 		const awaitedParentMetadata = await parentMetadata;
	// 		const { post, product } = props;

	// 		const pageMetadata  = {
	// 			title: \`\${post.title}\`,
	// 			description: product.details,
	// 		}

	// 		return {
	// 			...awaitedParentMetadata,
	// 			...pageMetadata
	// 		}
	// 	}

	//   `;

	// 	const { actual, expected } = transform(beforeText, afterText, '.tsx');

	// 	deepStrictEqual(
	// 		actual?.replace(/\s/gm, ''),
	// 		expected?.replace(/\s/gm, ''),
	// 	);
	// });

	// it('should not remove JSX comments', function (this: Context) {
	// 	const beforeText = `
	//   import Head from 'next/head';
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	//           <title>My page title</title>
	// 					{/* A JSX comment */}
	//         </Head>
	//       </>
	//     );
	//   }
	// 	`;

	// 	const afterText = `
	//   import { Metadata } from "next";
	// 	import Head from 'next/head';
	//   export const metadata: Metadata = {
	// 		title: \`My page title\`,
	// 	};
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	//           {/* this tag can be removed */}
	//                  <title>My page title</title>
	// 					{/* A JSX comment */}
	//         </Head>
	//       </>
	//     );
	//   }
	//   `;

	// 	const { actual, expected } = transform(beforeText, afterText, '.tsx');
	// 	deepStrictEqual(
	// 		actual?.replace(/\s/gm, ''),
	// 		expected?.replace(/\s/gm, ''),
	// 	);
	// });

	// it('should replace title tag - jsxExpression', function (this: Context) {
	// 	const beforeText = `
	// 	import { Metadata } from "next";
	//   import Head from 'next/head';
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 				<title>{process.env.VAR}</title>
	//         </Head>
	//       </>
	//     );
	//   }
	// 	`;

	// 	const afterText = `
	//   import { Metadata } from "next";
	// 	import Head from 'next/head';
	//   export const metadata: Metadata = {
	// 		title: \`\${process.env.VAR}\`,
	// 	};
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 				{/* this tag can be removed */}
	//                  <title>{process.env.VAR}</title>
	//         </Head>
	//       </>
	//     );
	//   }
	//   `;

	// 	const { actual, expected } = transform(beforeText, afterText, '.tsx');
	// 	deepStrictEqual(
	// 		actual?.replace(/\s/gm, ''),
	// 		expected?.replace(/\s/gm, ''),
	// 	);
	// });

	// it('should replace title tag - jsxExpression 2', function (this: Context) {
	// 	const beforeText = `
	//   import Head from 'next/head';
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 				<title>{\`My page title \${process.env.VAR}\`}</title>
	//         </Head>
	//       </>
	//     );
	//   }
	// 	`;

	// 	const afterText = `
	//   import { Metadata } from "next";
	// 	import Head from 'next/head';
	//   export const metadata: Metadata = {
	// 		title: \`My page title \${process.env.VAR}\`,
	// 	};
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 				{/* this tag can be removed */}
	//                  <title>{\`My page title \${process.env.VAR}\`}</title>
	//         </Head>
	//       </>
	//     );
	//   }
	//   `;

	// 	const { actual, expected } = transform(beforeText, afterText, '.tsx');
	// 	deepStrictEqual(
	// 		actual?.replace(/\s/gm, ''),
	// 		expected?.replace(/\s/gm, ''),
	// 	);
	// });

	// it('should replace title tag - jsxExpression 3', function (this: Context) {
	// 	const beforeText = `
	//   import Head from 'next/head';
	// 	const var1 = 1;
	// 	const text2 = 1;
	// 	const text = 1;
	// 	const var3 = 1;
	// 	const var4 = 1;
	// 	const fn = () => {};
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 				<title>{var1} text {fn()} text2 {var3 ? "literal1" : var4}</title>
	//         </Head>
	//       </>
	//     );
	//   }
	// 	`;

	// 	const afterText = `
	//   import { Metadata } from "next";
	// 	import Head from 'next/head';
	//   export const metadata: Metadata = {
	// 		title: \`\${var1} text \${fn()} text2 \${var3 ? "literal1": var4}\`,
	// 	};
	// 	const var1 = 1;
	// 	const text2 = 1;
	// 	const text = 1;
	// 	const var3 = 1;
	// 	const var4 = 1;
	// 	const fn = () => {};
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 				{/* this tag can be removed */}
	//                  <title>{var1} text {fn()} text2 {var3 ? "literal1" : var4}</title>
	//         </Head>
	//       </>
	//     );
	//   }
	//   `;

	// 	const { actual, expected } = transform(beforeText, afterText, '.tsx');
	// 	deepStrictEqual(
	// 		actual?.replace(/\s/gm, ''),
	// 		expected?.replace(/\s/gm, ''),
	// 	);
	// });

	// it('should replace meta tags - stringLiteral', function (this: Context) {
	// 	const beforeText = `
	//   import Head from 'next/head';
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
	//         </Head>
	//       </>
	//     );
	//   }
	// 	`;

	// 	const afterText = `
	//   import { Metadata } from "next";
	// 	import Head from 'next/head';
	//   export const metadata: Metadata = {
	// 		viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
	// 	};
	// 	export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					{/* this tag can be removed */}
	//                    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
	//         </Head>
	//       </>
	//     );
	//   }
	//   `;

	// 	const { actual, expected } = transform(beforeText, afterText, '.tsx');
	// 	deepStrictEqual(
	// 		actual?.replace(/\s/gm, ''),
	// 		expected?.replace(/\s/gm, ''),
	// 	);
	// });

	// it('should replace meta tags - expression', function (this: Context) {
	// 	const beforeText = `
	//   import Head from 'next/head';
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					<meta name="description" content={process.env.VAR} />
	//         </Head>
	//       </>
	//     );
	//   }
	// 	`;

	// 	const afterText = `
	//   import { Metadata } from "next";
	// 	import Head from 'next/head';
	//   export const metadata: Metadata = {
	// 		description: process.env.VAR,
	// 	};
	// 	export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					{/* this tag can be removed */}
	//                    <meta name="description" content={process.env.VAR} />
	//         </Head>
	//       </>
	//     );
	//   }
	//   `;

	// 	const { actual, expected } = transform(beforeText, afterText, '.tsx');
	// 	deepStrictEqual(
	// 		actual?.replace(/\s/gm, ''),
	// 		expected?.replace(/\s/gm, ''),
	// 	);
	// });

	// it('should support alternates meta tags', function (this: Context) {
	// 	const beforeText = `
	//   import Head from 'next/head';
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					<link rel="canonical" href="https://nextjs.org" />
	// 					<link rel="alternate" hreflang="en-US" href="https://nextjs.org/en-US" />
	// 					<link rel="alternate" hreflang="de-DE" href="https://nextjs.org/de-DE" />
	// 					<link
	// 						rel="alternate"
	// 						media="only screen and (max-width: 600px)"
	// 						href="https://nextjs.org/mobile"
	// 					/>
	// 					<link
	// 						rel="alternate"
	// 						type="application/rss+xml"
	// 						href="https://nextjs.org/rss"
	// 					/>
	//         </Head>
	//       </>
	//     );
	//   }
	// 	`;

	// 	const afterText = `
	//   import { Metadata } from "next";
	// 	import Head from 'next/head';
	//   export const metadata: Metadata = {
	// 		alternates: {
	// 			canonical: "https://nextjs.org",
	// 			languages: {
	// 				"en-US": "https://nextjs.org/en-US",
	// 				"de-DE": "https://nextjs.org/de-DE",
	// 			},
	// 			media: {
	// 				"only screen and (max-width: 600px)": "https://nextjs.org/mobile",
	// 			},
	// 			types: {
	// 				"application/rss+xml": "https://nextjs.org/rss",
	// 			},
	// 		},
	// 	};

	// 	export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					{/* this tag can be removed */}
	//                    <link rel="canonical" href="https://nextjs.org" />
	// 					{/* this tag can be removed */}
	//                    <link rel="alternate" hreflang="en-US" href="https://nextjs.org/en-US" />
	// 					{/* this tag can be removed */}
	//                    <link rel="alternate" hreflang="de-DE" href="https://nextjs.org/de-DE" />
	// 					{/* this tag can be removed */}
	//                    <link
	// 					rel="alternate"
	// 					media="only screen and (max-width: 600px)"
	// 					href="https://nextjs.org/mobile"
	// 				/>
	// 					{/* this tag can be removed */}
	//                    <link
	// 					rel="alternate"
	// 					type="application/rss+xml"
	// 					href="https://nextjs.org/rss"
	// 				/>
	//         </Head>
	//       </>
	//     );
	//   }
	//   `;

	// 	const { actual, expected } = transform(beforeText, afterText, '.tsx');
	// 	deepStrictEqual(
	// 		actual?.replace(/\s/gm, ''),
	// 		expected?.replace(/\s/gm, ''),
	// 	);
	// });

	// it('should support icons meta tags', function (this: Context) {
	// 	const beforeText = `
	//   import Head from 'next/head';
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					<link rel="shortcut icon" href="/shortcut-icon.png" />
	// 					<link
	// 						rel="apple-touch-icon"
	// 						sizes="180x180"
	// 						href="/favicon/apple-touch-icon.png"
	// 					/>
	// 					<link
	// 						rel="icon"
	// 						type="image/png"
	// 						sizes="32x32"
	// 						href="/favicon/favicon-32x32.png"
	// 					/>
	// 					<link
	// 						rel="icon"
	// 						type="image/png"
	// 						sizes="16x16"
	// 						href="/favicon/favicon-16x16.png"
	// 					/>
	// 					<link
	// 						rel="mask-icon"
	// 						href="/favicon/safari-pinned-tab.svg"
	// 						color="#000000"
	// 					/>
	//         </Head>
	//       </>
	//     );
	//   }
	// 	`;

	// 	const afterText = `
	//   import { Metadata } from "next";
	// 	import Head from 'next/head';
	//   export const metadata: Metadata = {
	// 		icons: {
	// 			shortcut: [{ url: "/shortcut-icon.png", }],
	// 			apple: [{ sizes: "180x180", url: "/favicon/apple-touch-icon.png", }],
	// 			icon: [
	// 				{ sizes: "32x32", type: "image/png", url: "/favicon/favicon-32x32.png", },
	// 				{
	// 					sizes: "16x16",
	// 					type: "image/png",
	// 					url: "/favicon/favicon-16x16.png",
	// 				}
	// 			],
	// 			other: [
	// 				{
	// 					url: "/favicon/safari-pinned-tab.svg",
	// 					rel: "mask-icon",
	// 				}
	// 			],
	// 		},
	// 	};

	// 	export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					{/* this tag can be removed */}
	// 					<link rel="shortcut icon" href="/shortcut-icon.png" />
	// 					{/* this tag can be removed */}
	// 					<link
	// 					rel="apple-touch-icon"
	// 					sizes="180x180"
	// 					href="/favicon/apple-touch-icon.png"
	// 					/>
	// 					{/* this tag can be removed */}
	// 					<link
	// 						rel="icon"
	// 						type="image/png"
	// 						sizes="32x32"
	// 						href="/favicon/favicon-32x32.png"
	// 					/>
	// 					{/* this tag can be removed */}
	// 					<link
	// 						rel="icon"
	// 						type="image/png"
	// 						sizes="16x16"
	// 						href="/favicon/favicon-16x16.png"
	// 					/>
	// 					{/* this tag can be removed */}
	// 					<link
	// 					rel="mask-icon"
	// 					href="/favicon/safari-pinned-tab.svg"
	// 					color="#000000"
	// 				/>
	// 				</Head>
	//       </>
	//     );
	//   }
	//   `;

	// 	const { actual, expected } = transform(beforeText, afterText, '.tsx');

	// 	deepStrictEqual(
	// 		actual?.replace(/\s/gm, ''),
	// 		expected?.replace(/\s/gm, ''),
	// 	);
	// });

	// it('should support verification meta tags', function (this: Context) {
	// 	const beforeText = `
	//   import Head from 'next/head';
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					<meta name="google-site-verification" content="google" />
	// 					<meta name="yandex-verification" content="yandex" />
	// 					<meta name="y_key" content="yahoo" />
	//         </Head>
	//       </>
	//     );
	//   }
	// 	`;

	// 	const afterText = `
	//   import { Metadata } from "next";
	// 	import Head from 'next/head';
	//   export const metadata: Metadata = {
	// 		verification: {
	// 			google: "google",
	// 			yandex: "yandex",
	// 			yahoo: "yahoo",
	// 		},
	// 	};

	// 	export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					{/* this tag can be removed */}
	// 					<meta name="google-site-verification" content="google" />
	// 					{/* this tag can be removed */}
	// 					<meta name="yandex-verification" content="yandex" />
	// 					{/* this tag can be removed */}
	// 					<meta name="y_key" content="yahoo" />
	// 				</Head>
	//       </>
	//     );
	//   }
	//   `;

	// 	const { actual, expected } = transform(beforeText, afterText, '.tsx');
	// 	deepStrictEqual(
	// 		actual?.replace(/\s/gm, ''),
	// 		expected?.replace(/\s/gm, ''),
	// 	);
	// });

	// it('should support openGraph "website" meta tags', function (this: Context) {
	// 	const beforeText = `
	//   import Head from 'next/head';
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					<meta property="og:determiner" content="the" />
	// 					<meta property="og:title" content="Next.js" />
	// 					<meta property="og:description" content="The React Framework for the Web" />
	// 					<meta property="og:url" content="https://nextjs.org/" />
	// 					<meta property="og:site_name" content="Next.js" />
	// 					<meta property="og:locale" content="en_US" />
	// 					<meta property="og:locale:alternate" content="fr_FR" />
	// 					<meta property="og:locale:alternate" content="es_ES" />
	// 					<meta property="og:type" content="website" />
	// 					<meta property="og:image:url" content="https://nextjs.org/og.png" />
	// 					<meta property="og:image:width" content="800" />
	// 					<meta property="og:image:height" content="600" />
	// 					<meta property="og:image:url" content="https://nextjs.org/og-alt.png" />
	// 					<meta property="og:image:width" content="1800" />
	// 					<meta property="og:image:height" content="1600" />
	// 					<meta property="og:image:alt" content="My custom alt" />
	// 					<meta property="og:audio" content="https://example.com/sound.mp3" />
	// 					<meta property="og:audio:secure_url" content="https://secure.example.com/sound.mp3" />
	// 					<meta property="og:audio:type" content="audio/mpeg" />
	// 					<meta property="og:video" content="https://example.com/movie.swf" />
	// 					<meta property="og:video:secure_url" content="https://secure.example.com/movie.swf" />
	// 					<meta property="og:video:type" content="application/x-shockwave-flash" />
	// 					<meta property="og:video:width" content="400" />
	// 					<meta property="og:video:height" content="300" />
	//         </Head>
	//       </>
	//     );
	//   }
	// 	`;

	// 	const afterText = `
	//   import { Metadata } from "next";
	// 	import Head from 'next/head';
	//   export const metadata: Metadata = {
	// 		openGraph: {
	// 			determiner: "the",
	// 			title: "Next.js",
	// 			description: "The React Framework for the Web",
	// 			url: "https://nextjs.org/",
	// 			siteName: "Next.js",
	// 			locale: "en_US",
	// 			alternateLocale: ["fr_FR", "es_ES"],
	// 			type: "website",
	// 			images: [{
	// 				url: "https://nextjs.org/og.png",
	// 				width: "800",
	// 				height: "600",
	// 			}, {
	// 					url: "https://nextjs.org/og-alt.png",
	// 					width: "1800",
	// 					height: "1600",
	// 					alt: "My custom alt",
	// 			}],
	// 			audio: [{
	// 				url: "https://example.com/sound.mp3",
	// 				secureUrl: "https://secure.example.com/sound.mp3",
	// 				type: "audio/mpeg",
	// 			}],
	// 			videos: [{
	// 				url: "https://example.com/movie.swf",
	// 				secureUrl: "https://secure.example.com/movie.swf",
	// 				type: "application/x-shockwave-flash",
	// 				width: "400",
	// 				height: "300",
	// 			}],
	// 		},
	// 	};

	// 	export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					{/* this tag can be removed */}
	// 					<meta property="og:determiner" content="the" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:title" content="Next.js" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:description" content="The React Framework for the Web" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:url" content="https://nextjs.org/" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:site_name" content="Next.js" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:locale" content="en_US" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:locale:alternate" content="fr_FR" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:locale:alternate" content="es_ES" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:type" content="website" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:image:url" content="https://nextjs.org/og.png" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:image:width" content="800" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:image:height" content="600" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:image:url" content="https://nextjs.org/og-alt.png" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:image:width" content="1800" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:image:height" content="1600" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:image:alt" content="My custom alt" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:audio" content="https://example.com/sound.mp3" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:audio:secure_url" content="https://secure.example.com/sound.mp3" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:audio:type" content="audio/mpeg" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:video" content="https://example.com/movie.swf" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:video:secure_url" content="https://secure.example.com/movie.swf" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:video:type" content="application/x-shockwave-flash" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:video:width" content="400" />
	// 					{/* this tag can be removed */}
	// 					<meta property="og:video:height" content="300" />
	// 				</Head>
	//       </>
	//     );
	//   }
	//   `;

	// 	const { actual, expected } = transform(beforeText, afterText, '.tsx');

	// 	deepStrictEqual(
	// 		actual?.replace(/\s/gm, ''),
	// 		expected?.replace(/\s/gm, ''),
	// 	);
	// });

	// it('should support openGraph "article" meta tags', function (this: Context) {
	// 	const beforeText = `
	//   import Head from 'next/head';
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					<meta property="og:type" content="article" />
	// 					<meta property="article:published_time" content="2023-07-20T12:24:36.871Z" />
	// 					<meta property="article:modified_time" content="2023-07-20T12:24:36.871Z" />
	// 					<meta property="article:expiration_time" content="2023-07-20T12:24:36.871Z" />
	// 					<meta property="article:author" content="Seb" />
	// 					<meta property="article:author" content="Josh" />
	// 					<meta property="article:section" content="Technology" />
	// 					<meta property="article:tag" content="tag1" />
	// 					<meta property="article:tag" content="tag2" />
	//         </Head>
	//       </>
	//     );
	//   }
	// 	`;

	// 	const afterText = `
	//   import { Metadata } from "next";
	// 	import Head from 'next/head';
	//   export const metadata: Metadata = {
	// 		openGraph: {
	// 			type: "article",
	// 			publishedTime: "2023-07-20T12:24:36.871Z",
	// 			modifiedTime: "2023-07-20T12:24:36.871Z",
	// 			expirationTime: "2023-07-20T12:24:36.871Z",
	// 			authors: ["Seb", "Josh"],
	// 			section: "Technology",
	// 			tags: ["tag1", "tag2"],
	// 		},
	// 	};

	// 	export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					{/* this tag can be removed */}
	// 					<meta property="og:type" content="article" />
	// 					{/* this tag can be removed */}
	// 					<meta property="article:published_time" content="2023-07-20T12:24:36.871Z" />
	// 					{/* this tag can be removed */}
	// 					<meta property="article:modified_time" content="2023-07-20T12:24:36.871Z" />
	// 					{/* this tag can be removed */}
	// 					<meta property="article:expiration_time" content="2023-07-20T12:24:36.871Z" />
	// 					{/* this tag can be removed */}
	// 					<meta property="article:author" content="Seb" />
	// 					{/* this tag can be removed */}
	// 					<meta property="article:author" content="Josh" />
	// 					{/* this tag can be removed */}
	// 					<meta property="article:section" content="Technology" />
	// 					{/* this tag can be removed */}
	// 					<meta property="article:tag" content="tag1" />
	// 					{/* this tag can be removed */}
	// 					<meta property="article:tag" content="tag2" />
	// 				</Head>
	//       </>
	//     );
	//   }
	//   `;

	// 	const { actual, expected } = transform(beforeText, afterText, '.tsx');

	// 	deepStrictEqual(
	// 		actual?.replace(/\s/gm, ''),
	// 		expected?.replace(/\s/gm, ''),
	// 	);
	// });

	// it('should support twitter meta tags', function (this: Context) {
	// 	const beforeText = `
	//   import Head from 'next/head';
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					<meta name="twitter:card" content="summary_large_image" />
	// 					<meta name="twitter:title" content="Next.js" />
	// 					<meta name="twitter:description" content="The React Framework for the Web" />
	// 					<meta name="twitter:site:id" content="1467726470533754880" />
	// 					<meta name="twitter:creator" content="@nextjs" />
	// 					<meta name="twitter:creator:id" content="1467726470533754880" />
	//         </Head>
	//       </>
	//     );
	//   }
	// 	`;

	// 	const afterText = `
	//   import { Metadata } from "next";
	// 	import Head from 'next/head';
	//   export const metadata: Metadata = {
	// 		twitter: {
	// 			card: "summary_large_image",
	// 			title: "Next.js",
	// 			description: "The React Framework for the Web",
	// 			siteId: "1467726470533754880",
	// 			creator: "@nextjs",
	// 			creatorId: "1467726470533754880",
	// 		},
	// 	};

	// 	export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					{/* this tag can be removed */}
	// 					<meta name="twitter:card" content="summary_large_image" />
	// 					{/* this tag can be removed */}
	// 					<meta name="twitter:title" content="Next.js" />
	// 					{/* this tag can be removed */}
	// 					<meta name="twitter:description" content="The React Framework for the Web" />
	// 					{/* this tag can be removed */}
	// 					<meta name="twitter:site:id" content="1467726470533754880" />
	// 					{/* this tag can be removed */}
	// 					<meta name="twitter:creator" content="@nextjs" />
	// 					{/* this tag can be removed */}
	// 					<meta name="twitter:creator:id" content="1467726470533754880" />
	// 				</Head>
	//       </>
	//     );
	//   }
	//   `;

	// 	const { actual, expected } = transform(beforeText, afterText, '.tsx');
	// 	deepStrictEqual(
	// 		actual?.replace(/\s/gm, ''),
	// 		expected?.replace(/\s/gm, ''),
	// 	);
	// });

	// it('should replace "other" metatags', function (this: Context) {
	// 	const beforeText = `
	//   import Head from 'next/head';
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					<meta name="msapplication-TileColor" content="#000000" />
	// 					<meta name="msapplication-config" content="/favicon/browserconfig.xml" />
	//         </Head>
	//       </>
	//     );
	//   }
	// 	`;

	// 	const afterText = `
	//   import { Metadata } from "next";
	// 	import Head from 'next/head';
	//   export const metadata: Metadata = {
	// 		other: {
	// 			"msapplication-TileColor": "#000000",
	// 			"msapplication-config": "/favicon/browserconfig.xml",
	// 		},
	// 	};

	// 	export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					{/* this tag can be removed */}
	// 					<meta name="msapplication-TileColor" content="#000000" />
	// 					{/* this tag can be removed */}
	// 					<meta name="msapplication-config" content="/favicon/browserconfig.xml" />
	// 				</Head>
	//       </>
	//     );
	//   }
	//   `;

	// 	const { actual, expected } = transform(beforeText, afterText, '.tsx');
	// 	deepStrictEqual(
	// 		actual?.replace(/\s/gm, ''),
	// 		expected?.replace(/\s/gm, ''),
	// 	);
	// });

	// it('should support basic metadata', function (this: Context) {
	// 	const beforeText = `
	//   import Head from 'next/head';
	// 	const var1 = 1;
	// 	const var2 = 1;
	// 	const var3 = 1;
	// 	const var4 = 1;
	// 	const var5 = 1;
	// 	const var6 = 1;
	// 	const var7 = 1;
	// 	const var8 = 1;
	// 	const var9 = 1;
	// 	const var10 = 1;
	// 	const var11 = 1;
	// 	const var12 = 1;
	// 	const var13 = 1;
	// 	const var14 = 1;
	// 	const var15 = 1;
	// 	const var16 = 1;
	// 	const var17 = 1;
	// 	const var18 = 1;
	// 	const var19 = 1;
	// 	const var20 = 1;
	// 	const var21 = 1;
	// 	const var22 = 1;
	// 	const var23 = 1;
	// 	const var24 = 1;
	//   export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 						<title>{var1}</title>
	// 						<meta name="description" content={var2} />
	// 						<meta name="application-name" content={var3} />
	// 						<meta name="author" content={var4} />
	// 						<link rel="author" href={var5} />
	// 						<meta name="author" content={var6}/>
	// 						<link rel="manifest" href={var7} />
	// 						<meta name="generator" content={var8} />
	// 						<meta name="keywords" content={var9} />
	// 						<meta name="referrer" content={var10} />
	// 						<meta name="theme-color" media="(prefers-color-scheme: light)" content={var11} />
	// 						<meta name="theme-color" media="(prefers-color-scheme: dark)" content={var12} />
	// 						<meta name="theme-color" content="#000" />
	// 						<meta name="color-scheme" content={var13} />
	// 						<meta name="viewport" content={var14} />
	// 						<meta name="creator" content={var15} />
	// 						<meta name="publisher" content={var16} />
	// 						<meta name="robots" content={var17} />
	// 						<meta name="googlebot" content={var18} />
	// 						<meta name="abstract" content={var19} />
	// 						<link rel="archives" href={var20} />
	// 						<link rel="assets" href={var21} />
	// 						<link rel="bookmarks" href={var22}/>
	// 						<meta name="category" content={var23} />
	// 						<meta name="classification" content={var24} />
	//         </Head>
	//       </>
	//     );
	//   }
	// 	`;

	// 	const afterText = `
	//   import { Metadata } from "next";
	// 	import Head from 'next/head';
	//   export const metadata: Metadata = {
	// 		title: \`\${var1}\`,
	// 		description: var2,
	// 		applicationName: var3,
	// 		authors:  [{ name: var4, url: var5, }, { name: var6, }],
	// 		manifest: var7,
	// 		generator: var8,
	// 		keywords: var9,
	// 		referrer: var10,
	// 		themeColor: [
	// 			{ media: "(prefers-color-scheme: light)", color: var11, },
	// 			{ media: "(prefers-color-scheme: dark)", color: var12, },
	// 			{ color: "#000", }
	// 		],
	// 		colorScheme: var13,
	// 		viewport: var14,
	// 		creator: var15,
	// 		publisher: var16,
	// 		robots: var17,
	// 		abstract: var19,
	// 		archives: [var20],
	// 		assets: [var21],
	// 		bookmarks: [var22],
	// 		category: var23,
	// 		classification: var24,
	// 	};
	// 	const var1 = 1;
	// 	const var2 = 1;
	// 	const var3 = 1;
	// 	const var4 = 1;
	// 	const var5 = 1;
	// 	const var6 = 1;
	// 	const var7 = 1;
	// 	const var8 = 1;
	// 	const var9 = 1;
	// 	const var10 = 1;
	// 	const var11 = 1;
	// 	const var12 = 1;
	// 	const var13 = 1;
	// 	const var14 = 1;
	// 	const var15 = 1;
	// 	const var16 = 1;
	// 	const var17 = 1;
	// 	const var18 = 1;
	// 	const var19 = 1;
	// 	const var20 = 1;
	// 	const var21 = 1;
	// 	const var22 = 1;
	// 	const var23 = 1;
	// 	const var24 = 1;

	// 	export default function Page() {
	//     return (
	//       <>
	//         <Head>
	// 					{/* this tag can be removed */}
	// 					<title>{var1}</title>
	// 					{/* this tag can be removed */}
	// 					<meta name="description" content={var2} />
	// 					{/* this tag can be removed */}
	// 					<meta name="application-name" content={var3} />
	// 					{/* this tag can be removed */}
	// 					<meta name="author" content={var4} />
	// 					{/* this tag can be removed */}
	// 					<link rel="author" href={var5} />
	// 					{/* this tag can be removed */}
	// 					<meta name="author" content={var6}/>
	// 					{/* this tag can be removed */}
	// 					<link rel="manifest" href={var7} />
	// 					{/* this tag can be removed */}
	// 					<meta name="generator" content={var8} />
	// 					{/* this tag can be removed */}
	// 					<meta name="keywords" content={var9} />
	// 					{/* this tag can be removed */}
	// 					<meta name="referrer" content={var10} />
	// 					{/* this tag can be removed */}
	// 					<meta name="theme-color" media="(prefers-color-scheme: light)" content={var11} />
	// 					{/* this tag can be removed */}
	// 					<meta name="theme-color" media="(prefers-color-scheme: dark)" content={var12} />
	// 					{/* this tag can be removed */}
	// 					<meta name="theme-color" content="#000" />
	// 					{/* this tag can be removed */}
	// 					<meta name="color-scheme" content={var13} />
	// 					{/* this tag can be removed */}
	// 					<meta name="viewport" content={var14} />
	// 					{/* this tag can be removed */}
	// 					<meta name="creator" content={var15} />
	// 					{/* this tag can be removed */}
	// 					<meta name="publisher" content={var16} />
	// 					{/* this tag can be removed */}
	// 					<meta name="robots" content={var17} />
	// 					<meta name="googlebot" content={var18} />
	// 					{/* this tag can be removed */}
	// 					<meta name="abstract" content={var19} />
	// 					{/* this tag can be removed */}
	// 					<link rel="archives" href={var20} />
	// 					{/* this tag can be removed */}
	// 					<link rel="assets" href={var21} />
	// 					{/* this tag can be removed */}
	// 					<link rel="bookmarks" href={var22}/>
	// 					{/* this tag can be removed */}
	// 					<meta name="category" content={var23} />
	// 					{/* this tag can be removed */}
	// 					<meta name="classification" content={var24} />
	// 				</Head>
	//       </>
	//     );
	//   }
	//   `;

	// 	const { actual, expected } = transform(beforeText, afterText, '.tsx');

	// 	deepStrictEqual(
	// 		actual?.replace(/\s/gm, ''),
	// 		expected?.replace(/\s/gm, ''),
	// 	);
	// });

	// it('should not move tag, if its attributes has variables that are not defined in top level scope', function (this: Context) {
	// 	const beforeText = `
	//   import Head from "next/head";
	// 	import { var5 } from "module";
	// 	import * as var6 from "module";
	// 	import var7 from "module";
	// 	const var1 = 1;
	// 	const var2 = 2, var3 = 3;
	// 	const var4 = () => {};
	// 	const varobj1 = {}

	//   export default function Page() {
	// 		const { t } = useHook();
	// 		const var1 = 1;
	//     return (
	//       <>
	//         <Head>
	// 					<meta name="description" content={t("quick_video_meeting")} />
	// 					<meta name="creator" content={var1} />
	// 					<meta name="description" content={var2 + var3} />
	// 					<meta name="creator" content={varobj.prop} />
	// 					<meta name="referrer" content={varobj1.prop} />
	//         </Head>
	//       </>
	//     );
	//   }
	// 	`;

	// 	const afterText = `
	//   import { Metadata } from "next";
	// 	import Head from "next/head";
	// 	import { var5 } from "module";
	// 	import * as var6 from "module";
	// 	import var7 from "module";
	// 	export const metadata: Metadata = {
	// 		description: var2 + var3,
	// 		referrer: varobj1.prop,
	// 	};

	// 	const var1 = 1;
	// 	const var2 = 2, var3 = 3;
	// 	const var4 = () => {};
	// 	const varobj1 = {}

	// 	export default function Page() {
	// 		const { t } = useHook();
	// 		const var1 = 1;
	//     return (
	//       <>
	// 			<Head>
	// 				{/* this tag cannot be removed, because it uses variables from inner scope */}
	// 				<meta name="description" content={t("quick_video_meeting")} />
	// 				{/* this tag cannot be removed, because it uses variables from inner scope */}
	// 				<meta name="creator" content={var1} />
	// 				{/* this tag can be removed */}
	// 				<meta name="description" content={var2 + var3} />
	// 				{/* this tag cannot be removed, because it uses variables from inner scope */}
	// 				<meta name="creator" content={varobj.prop} />
	// 				{/* this tag can be removed */}
	// 				<meta name="referrer" content={varobj1.prop} />
	//  		</Head>
	//       </>
	//     );
	//   }
	//   `;

	// 	const { actual, expected } = transform(beforeText, afterText, '.tsx');

	// 	deepStrictEqual(
	// 		actual?.replace(/\s/gm, ''),
	// 		expected?.replace(/\s/gm, ''),
	// 	);
	// });
});
