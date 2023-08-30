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

export const getStaticPaths = () => {

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

		deepStrictEqual(externalFileCommands.length, 18);

		ok(
			externalFileCommands.some(
				(command) =>
					command.kind === 'deleteFile' &&
					command.path === '/opt/project/pages/_app.jsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) =>
					command.kind === 'deleteFile' &&
					command.path === '/opt/project/pages/_document.jsx',
			),
		);

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

		ok(
			externalFileCommands.some((command) => {
				return (
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/app/components.tsx' &&
					command.data.replace(/\W/gm, '') ===
						`
					'use client';
					// This file has been sourced from: /opt/project/pages/index.jsx
					
					export default function Index({}) {
						return null;
					}
				;`.replace(/\W/gm, '')
				);
			}),
		);

		ok(
			externalFileCommands.some((command) => {
				return (
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/app/[a]/c/page.tsx' &&
					command.data.replace(/\W/gm, '') ===
						`
						// This file has been sourced from: /opt/project/pages/[a]/c.tsx
						import Components from "./components";
						// TODO reimplement getServerSideProps with custom logic
						const getServerSideProps = () => {
						};
						export default async function Page(props: any) {
							return <Components {...props}/>;
						}
					`.replace(/\W/gm, '')
				);
			}),
		);

		ok(
			externalFileCommands.some((command) => {
				return (
					command.kind === 'upsertFile' &&
					command.path ===
						'/opt/project/app/[a]/[b]/components.tsx' &&
					command.data.replace(/\W/gm, '') ===
						"'use client';".replace(/\W/gm, '')
				);
			}),
		);
	});

	it('should build neither error files nor not-found files if no such previous files were found', async function (this: Context) {
		const externalFileCommands = await transform({
			'/opt/project/pages/index.jsx': '',
			'/opt/project/pages/_app.jsx': '',
			'/opt/project/pages/_document.jsx': '',
		});

		deepStrictEqual(externalFileCommands.length, 7);

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

		deepStrictEqual(externalFileCommands.length, 13);

		ok(
			externalFileCommands.some((command) => {
				return (
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/app/[a]/c/page.mdx' &&
					command.data.replace(/\W/gm, '') ===
						`
						// This file has been sourced from: /opt/project/pages/[a]/c.mdx
						import Components from "./components";

						// TODO reimplement getServerSideProps with custom logic
						const getServerSideProps = () => {};

						export default async function Page(props: any) {
							return <Components>{ ...props } />;
						}
					`.replace(/\W/gm, '')
				);
			}),
		);

		ok(
			externalFileCommands.some((command) => {
				return (
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/app/[a]/[b]/page.mdx' &&
					command.data.replace(/\W/gm, '') ===
						`
						// This file has been sourced from: /opt/project/pages/[a]/[b].mdx
						import Components from "./components";
						export default async function Page(props: any) {
							return <Components>{ ...props } />
						}
						
						import Components from "./components";

						const getStaticPaths = () => {};

						export default async function Page(props: any) {
						    return <Components>{ ...props } />;
						}
					`.replace(/\W/gm, '')
				);
			}),
		);
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

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const [upsertFileCommand, _, deleteIndexJsxCommand] = await transform({
			'/opt/project/pages/index.jsx': content,
		});

		deepStrictEqual(upsertFileCommand?.kind, 'upsertFile');
		deepStrictEqual(upsertFileCommand?.path, '/opt/project/app/page.tsx');

		deepStrictEqual(
			upsertFileCommand?.data.replace(/\W/gm, ''),
			`
				// This file has been sourced from: /opt/project/pages/index.jsx
				import Components from "./components";
				export default async function Page(props: any) {
					return <Components {...props}/>;
				}
			`.replace(/\W/gm, ''),
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

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const [upsertFileCommand, _, deleteIndexJsxCommand] = await transform({
			'/opt/project/pages/index.jsx': content,
		});

		deepStrictEqual(upsertFileCommand?.kind, 'upsertFile');
		deepStrictEqual(upsertFileCommand?.path, '/opt/project/app/page.tsx');

		deepStrictEqual(
			upsertFileCommand?.data.replace(/\W/gm, ''),
			`// This file has been sourced from: /opt/project/pages/index.jsx
			import Components from "./components";
			export default async function Page(props: any) {
				return <Components {...props}/>;
			}
			`.replace(/\W/gm, ''),
		);

		deepStrictEqual(deleteIndexJsxCommand?.kind, 'deleteFile');
		deepStrictEqual(
			deleteIndexJsxCommand?.path,
			'/opt/project/pages/index.jsx',
		);
	});

	it('should move the CSS import statement from _app to layout', async function (this: Context) {
		const _app = `
		import { AppProps } from 'next/app'
		import '../styles/index.css'
		
		function MyApp({ Component, pageProps }: AppProps) {
			return <Component {...pageProps} />
		}
		
		export default MyApp
		`;

		const _document = `
		import { Html, Main, NextScript } from 'next/document'

		export default function Document() {
			return (
				<Html lang="en">
					<body>
						<Main />
						<NextScript />
					</body>
				</Html>
			)
		}
		`;

		const index = `
			export default async function Index() {
				return null;
			}
		`;

		const [upsertLayoutCommand, upsertLayoutClientComponentCommand] =
			await transform({
				'/opt/project/pages/_app.tsx': _app,
				'/opt/project/pages/_document.tsx': _document,
				'/opt/project/pages/index.tsx': index,
			});

		deepStrictEqual(upsertLayoutCommand?.kind, 'upsertFile');
		deepStrictEqual(
			upsertLayoutCommand?.path,
			'/opt/project/app/layout.tsx',
		);

		deepStrictEqual(upsertLayoutClientComponentCommand?.kind, 'upsertFile');
		deepStrictEqual(
			upsertLayoutClientComponentCommand?.path,
			'/opt/project/app/layout-client-component.tsx',
		);

		const layout = `
		import LayoutClientComponent from './layout-client-component';
		
		export default function RootLayout({ children }: {
				children: React.ReactNode;
		}) {
				return (<html lang="en">
									<body>
											<LayoutClientComponent />
									</body>
								</html>);
		}
		`;

		const layoutClientComponent = `
		"use client"
		import { AppProps } from 'next/app'
		import '../styles/index.css'
		
		function LayoutClientComponent({ children }: { children: React.ReactNode }) {
			return <> { children } </>
		}
		
		export default LayoutClientComponent
		`;

		deepStrictEqual(
			upsertLayoutCommand?.data.replace(/\W/gm, ''),
			layout.replace(/\W/gm, ''),
		);

		deepStrictEqual(
			upsertLayoutClientComponentCommand?.data.replace(/\W/gm, ''),
			layoutClientComponent.replace(/\W/gm, ''),
		);
	});

	it('should replace next/document tags with html tags in layout file', async function (this: Context) {
		const index = `
			export default async function Index() {
				return null;
			}
		`;

		const _document = `
	 import { Html, Head, Main, NextScript } from "next/document";
		export default function Document() {
			return (
				<Html lang="en">
					<Head />
					<body>
						<Main />
						<NextScript />
					</body>
				</Html>
			);
		}
	 `;

		const _app = `
	import { Analytics } from "@vercel/analytics/react";
	import "react-static-tweets/styles.css";
	import { MDXProvider } from "@mdx-js/react";
	const components = {};

	export default function App({ Component, pageProps }) {
		return 	<>
		<MDXProvider components={components}>
			<Component {...pageProps} />
		</MDXProvider>
		<Analytics />
	</>
	}
`;

		const [upsertLayoutCommand, upsertLayoutClientComponentCommand] =
			await transform({
				'/opt/project/pages/_app.tsx': _app,
				'/opt/project/pages/_document.tsx': _document,
				'/opt/project/pages/index.tsx': index,
			});

		deepStrictEqual(upsertLayoutCommand?.kind, 'upsertFile');
		deepStrictEqual(
			upsertLayoutCommand?.path,
			'/opt/project/app/layout.tsx',
		);

		deepStrictEqual(upsertLayoutClientComponentCommand?.kind, 'upsertFile');
		deepStrictEqual(
			upsertLayoutClientComponentCommand?.path,
			'/opt/project/app/layout-client-component.tsx',
		);

		const layout = `
		import LayoutClientComponent from './layout-client-component';
		
		export default function RootLayout({ children }: {
			children: React.ReactNode;
		}) {
			return (<html lang="en">
				<head />
				<body>
				<LayoutClientComponent />
				</body>
			</html>);
		}
		`;

		const layoutClientComponent = `
		"use client"
		import { Analytics } from "@vercel/analytics/react";
		import "react-static-tweets/styles.css";
		import { MDXProvider } from "@mdx-js/react";
		const components = {};

		export default function LayoutClientComponent({ children }: { children: React.ReactNode }) {
			return 	<>
			<MDXProvider components={components}>
				<>
				{ children }
				</>
			</MDXProvider>
			<Analytics />
		</>
	}
		`;

		deepStrictEqual(
			upsertLayoutCommand?.data.replace(/\W/gm, ''),
			layout.replace(/\W/gm, ''),
		);

		deepStrictEqual(
			upsertLayoutClientComponentCommand?.data.replace(/\W/gm, ''),
			layoutClientComponent.replace(/\W/gm, ''),
		);
	});

	it('should create a new client side file', async function (this: Context) {
		const index = `
			import ErrorPage from 'next/error';

			export default async function Index() {
				return <ErrorPage statusCode={404} />;
			}
		`;

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const [upsertLayoutCommand, , upsertPageCommand, _, deleteFileCommand] =
			await transform({
				'/opt/project/pages/index.tsx': index,
				'/opt/project/pages/_document.tsx': '',
				'/opt/project/pages/_app.tsx': '',
			});

		deepStrictEqual(upsertLayoutCommand?.kind, 'upsertFile');
		deepStrictEqual(
			upsertLayoutCommand?.path,
			'/opt/project/app/layout.tsx',
		);

		deepStrictEqual(upsertPageCommand?.kind, 'upsertFile');
		deepStrictEqual(upsertPageCommand?.path, '/opt/project/app/page.tsx');

		deepStrictEqual(
			upsertPageCommand?.data.replace(/\W/gm, ''),
			`// This file has been sourced from: /opt/project/pages/index.tsx
			import Components from "./components";
			export default async function Page(props: any) {
				return <Components {...props}/>;
			}`.replace(/\W/gm, ''),
		);

		// delete file command
		deepStrictEqual(deleteFileCommand?.kind, 'deleteFile');
		deepStrictEqual(
			deleteFileCommand?.path,
			'/opt/project/pages/index.tsx',
		);
	});

	it('should create a new client side file for a non-index page', async function (this: Context) {
		const index = `
			import ErrorPage from 'next/error';

			export default async function C() {
				return <ErrorPage statusCode={404} />;
			}
		`;

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const [upsertPageCommand, _, deleteFileCommand] = await transform({
			'/opt/project/pages/a/b/c.tsx': index,
		});

		deepStrictEqual(upsertPageCommand?.kind, 'upsertFile');
		deepStrictEqual(
			upsertPageCommand?.path,
			'/opt/project/app/a/b/c/page.tsx',
		);

		deepStrictEqual(
			upsertPageCommand?.data.replace(/(?!\.)\s/gm, ''),
			`// This file has been sourced from: /opt/project/pages/a/b/c.tsx
			import Components from "./components";
			
			export default async function Page(props: any) {
    			return <Components {...props}/>;
			}
			`.replace(/(?!\.)\s/gm, ''),
		);

		// delete file command

		deepStrictEqual(deleteFileCommand?.kind, 'deleteFile');
		deepStrictEqual(
			deleteFileCommand?.path,
			'/opt/project/pages/a/b/c.tsx',
		);
	});

	it('should remove export keyword from old data fetching methods', async function (this: Context) {
		const index = `
			export async function getStaticProps() {};
			
			export const getServerSideProps = async () => {};
			
			export async function getStaticPaths() {};
				
			export default async function Index() {
					return null;
			}
		`;

		const [command] = await transform({
			'/opt/project/pages/index.tsx': index,
		});

		deepStrictEqual(command?.kind, 'upsertFile');

		deepStrictEqual(
			command?.data.replace(/(?!\.)\s/gm, ''),
			`
			// This file has been sourced from: /opt/project/pages/index.tsx
			import Components from "./components";
			
			async function getStaticProps() { };
			
			// TODO reimplement getServerSideProps with custom logic
			const getServerSideProps = async () => { };
			
			async function getStaticPaths() { };
			
			export default async function Page(props: any) {
				return <Components {...props}/>;
			}

			`.replace(/(?!\.)\s/gm, ''),
		);
	});
});
