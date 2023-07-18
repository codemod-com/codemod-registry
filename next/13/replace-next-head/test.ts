import { Context } from 'mocha';
import { handleSourceFile } from './index.js';
import { Project } from 'ts-morph';
import { deepStrictEqual } from 'node:assert';

const transform = (
	beforeText: string,
	afterText: string,
	extension: '.js' | '.tsx',
) => {
	const project = new Project({
		useInMemoryFileSystem: true,
		skipFileDependencyResolution: true,
		compilerOptions: {
			allowJs: true,
		},
	});

	const actualSourceFile = project.createSourceFile(
		`actual${extension}`,
		beforeText,
	);
	const actual = handleSourceFile(actualSourceFile);

	const expected = project
		.createSourceFile(`expected${extension}`, afterText)
		.print();

	return {
		actual,
		expected,
	};
};

describe('next 13 replace-next-head', function () {
	it('should replace title tag - jsxText', function (this: Context) {
		const beforeText = `
	  import Head from 'next/head';
	  export default function Page() {
	    return (
	      <>
	        <Head>
	          <title>My page title</title>
	        </Head>
	      </>
	    );
	  }
		`;

		const afterText = `
	  import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			title: \`My page title\`,
		};
	  export default function Page() {
	    return (
	      <>
	        <Head>
	          {/* this tag can be removed */}
	                 <title>My page title</title>
	        </Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(
			actual?.replace(/\s/gm, ''),
			expected?.replace(/\s/gm, ''),
		);
	});

	it('should insert generateMetadata function if metadata tags depend on component props', function (this: Context) {
		const beforeText = `
	  import Head from 'next/head';
		
		export async function getStaticProps ({ params }) {
			const { post, product } = fetchData(params.id);
			
			return {
				props: {
					post, 
					product, 
				}
			}
		}
		
	  export default function Page({ post, product }) {
	    return (
	      <>
	        <Head>
	          <title>{post.title}</title>
						<meta name="description" content={product.details} />
	        </Head>
	      </>
	    );
	  }
		`;

		const afterText = `
	  import { Metadata, ResolvingMetadata } from "next";
		import Head from 'next/head';
	  
		type Params = Record<string, string |  string[]>;
		
		export async function _getStaticProps ({ params }) {
			const { post, product } = fetchData(params.id);
			
			return {
				props: {
					post, 
					product, 
				}
			}
		}
		
	  export default function Page({ post, product }) {
	    return (
	      <>
	        <Head>
	          {/* this tag can be removed */}
						<title>{post.title}</title>
						{/* this tag can be removed */}
						<meta name="description" content={product.details} />
	        </Head>
	      </>
	    );
	  }
		export async function generateMetadata(
			{ params }: { params: Params },
			parentMetadata: ResolvingMetadata
		): Promise<Metadata> {
			const { props }  = await _getStaticProps({ params });
			
			const awaitedParentMetadata = await parentMetadata;
			const { post, product } = props;
			
			const pageMetadata  = {
				title: \`\${post.title}\`, 
				description: product.details, 
			}
			
			return {
				...awaitedParentMetadata, 
				...pageMetadata
			}
		}
		
		
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(
			actual?.replace(/\s/gm, ''),
			expected?.replace(/\s/gm, ''),
		);
	});

	it('should not remove JSX comments', function (this: Context) {
		const beforeText = `
	  import Head from 'next/head';
	  export default function Page() {
	    return (
	      <>
	        <Head>
	          <title>My page title</title>
						{/* A JSX comment */}
	        </Head>
	      </>
	    );
	  }
		`;

		const afterText = `
	  import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			title: \`My page title\`,
		};
	  export default function Page() {
	    return (
	      <>
	        <Head>
	          {/* this tag can be removed */}
	                 <title>My page title</title>
						{/* A JSX comment */}
	        </Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(
			actual?.replace(/\s/gm, ''),
			expected?.replace(/\s/gm, ''),
		);
	});

	it('should replace title tag - jsxExpression', function (this: Context) {
		const beforeText = `
		import { Metadata } from "next";
	  import Head from 'next/head';
	  export default function Page() {
	    return (
	      <>
	        <Head>
					<title>{process.env.VAR}</title>
	        </Head>
	      </>
	    );
	  }
		`;

		const afterText = `
	  import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			title: \`\${process.env.VAR}\`,
		};
	  export default function Page() {
	    return (
	      <>
	        <Head>
					{/* this tag can be removed */}
	                 <title>{process.env.VAR}</title>
	        </Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(
			actual?.replace(/\s/gm, ''),
			expected?.replace(/\s/gm, ''),
		);
	});

	it('should replace title tag - jsxExpression 2', function (this: Context) {
		const beforeText = `
	  import Head from 'next/head';
	  export default function Page() {
	    return (
	      <>
	        <Head>
					<title>{\`My page title \${process.env.VAR}\`}</title>
	        </Head>
	      </>
	    );
	  }
		`;

		const afterText = `
	  import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			title: \`My page title \${process.env.VAR}\`,
		};
	  export default function Page() {
	    return (
	      <>
	        <Head>
					{/* this tag can be removed */}
	                 <title>{\`My page title \${process.env.VAR}\`}</title>
	        </Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(
			actual?.replace(/\s/gm, ''),
			expected?.replace(/\s/gm, ''),
		);
	});

	it('should replace title tag - jsxExpression 3', function (this: Context) {
		const beforeText = `
	  import Head from 'next/head';
		const var1 = 1;
		const text2 = 1;
		const text = 1;
		const var3 = 1;
		const var4 = 1;
		const fn = () => {};
	  export default function Page() {
	    return (
	      <>
	        <Head>
					<title>{var1} text {fn()} text2 {var3 ? "literal1" : var4}</title>
	        </Head>
	      </>
	    );
	  }
		`;

		const afterText = `
	  import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			title: \`\${var1} text \${fn()} text2 \${var3 ? "literal1": var4}\`,
		};
		const var1 = 1;
		const text2 = 1;
		const text = 1;
		const var3 = 1;
		const var4 = 1;
		const fn = () => {};
	  export default function Page() {
	    return (
	      <>
	        <Head>
					{/* this tag can be removed */}
	                 <title>{var1} text {fn()} text2 {var3 ? "literal1" : var4}</title>
	        </Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(
			actual?.replace(/\s/gm, ''),
			expected?.replace(/\s/gm, ''),
		);
	});

	it('should replace meta tags - stringLiteral', function (this: Context) {
		const beforeText = `
	  import Head from 'next/head';
	  export default function Page() {
	    return (
	      <>
	        <Head>
						<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
	        </Head>
	      </>
	    );
	  }
		`;

		const afterText = `
	  import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
		};
		export default function Page() {
	    return (
	      <>
	        <Head>
						{/* this tag can be removed */}
	                   <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
	        </Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(
			actual?.replace(/\s/gm, ''),
			expected?.replace(/\s/gm, ''),
		);
	});

	it('should replace meta tags - expression', function (this: Context) {
		const beforeText = `
	  import Head from 'next/head';
	  export default function Page() {
	    return (
	      <>
	        <Head>
						<meta name="description" content={process.env.VAR} />
	        </Head>
	      </>
	    );
	  }
		`;

		const afterText = `
	  import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			description: process.env.VAR,
		};
		export default function Page() {
	    return (
	      <>
	        <Head>
						{/* this tag can be removed */}
	                   <meta name="description" content={process.env.VAR} />
	        </Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(
			actual?.replace(/\s/gm, ''),
			expected?.replace(/\s/gm, ''),
		);
	});

	it('should support alternates meta tags', function (this: Context) {
		const beforeText = `
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

		const afterText = `
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
						{/* this tag can be removed */}
	                   <link rel="canonical" href="https://nextjs.org" />
						{/* this tag can be removed */}
	                   <link rel="alternate" hreflang="en-US" href="https://nextjs.org/en-US" />
						{/* this tag can be removed */}
	                   <link rel="alternate" hreflang="de-DE" href="https://nextjs.org/de-DE" />
						{/* this tag can be removed */}
	                   <link
						rel="alternate"
						media="only screen and (max-width: 600px)"
						href="https://nextjs.org/mobile"
					/>
						{/* this tag can be removed */}
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

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(
			actual?.replace(/\s/gm, ''),
			expected?.replace(/\s/gm, ''),
		);
	});

	it('should support icons meta tags', function (this: Context) {
		const beforeText = `
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

		const afterText = `
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
						{/* this tag can be removed */}
						<link rel="shortcut icon" href="/shortcut-icon.png" />
						{/* this tag can be removed */}
						<link
						rel="apple-touch-icon"
						sizes="180x180"
						href="/favicon/apple-touch-icon.png"
						/>
						{/* this tag can be removed */}
						<link
							rel="icon"
							type="image/png"
							sizes="32x32"
							href="/favicon/favicon-32x32.png"
						/>
						{/* this tag can be removed */}
						<link
							rel="icon"
							type="image/png"
							sizes="16x16"
							href="/favicon/favicon-16x16.png"
						/>
						{/* this tag can be removed */}
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

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(
			actual?.replace(/\s/gm, ''),
			expected?.replace(/\s/gm, ''),
		);
	});

	it('should support verification meta tags', function (this: Context) {
		const beforeText = `
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

		const afterText = `
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
						{/* this tag can be removed */}
						<meta name="google-site-verification" content="google" />
						{/* this tag can be removed */}
						<meta name="yandex-verification" content="yandex" />
						{/* this tag can be removed */}
						<meta name="y_key" content="yahoo" />
					</Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(
			actual?.replace(/\s/gm, ''),
			expected?.replace(/\s/gm, ''),
		);
	});

	it('should support openGraph meta tags', function (this: Context) {
		const beforeText = `
	  import Head from 'next/head';
	  export default function Page() {
	    return (
	      <>
	        <Head>
						<meta property="og:title" content="Next.js" />
						<meta property="og:description" content="The React Framework for the Web" />
						<meta property="og:url" content="https://nextjs.org/" />
						<meta property="og:site_name" content="Next.js" />
						<meta property="og:locale" content="en_US" />
						<meta property="og:type" content="website" />
						<meta property="og:image:url" content="https://nextjs.org/og.png" />
						<meta property="og:image:width" content="800" />
						<meta property="og:image:height" content="600" />
						<meta property="og:image:url" content="https://nextjs.org/og-alt.png" />
						<meta property="og:image:width" content="1800" />
						<meta property="og:image:height" content="1600" />
						<meta property="og:image:alt" content="My custom alt" />
	        </Head>
	      </>
	    );
	  }
		`;

		const afterText = `
	  import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = {
			openGraph: {
				title: "Next.js",
				description: "The React Framework for the Web",
				url: "https://nextjs.org/",
				siteName: "Next.js",
				locale: "en_US",
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
			},
		};

		export default function Page() {
	    return (
	      <>
	        <Head>
						{/* this tag can be removed */}
						<meta property="og:title" content="Next.js" />
						{/* this tag can be removed */}
						<meta property="og:description" content="The React Framework for the Web" />
						{/* this tag can be removed */}
						<meta property="og:url" content="https://nextjs.org/" />
						{/* this tag can be removed */}
						<meta property="og:site_name" content="Next.js" />
						{/* this tag can be removed */}
						<meta property="og:locale" content="en_US" />
						{/* this tag can be removed */}
						<meta property="og:type" content="website" />
						{/* this tag can be removed */}
						<meta property="og:image:url" content="https://nextjs.org/og.png" />
						{/* this tag can be removed */}
						<meta property="og:image:width" content="800" />
						{/* this tag can be removed */}
						<meta property="og:image:height" content="600" />
						{/* this tag can be removed */}
						<meta property="og:image:url" content="https://nextjs.org/og-alt.png" />
						{/* this tag can be removed */}
						<meta property="og:image:width" content="1800" />
						{/* this tag can be removed */}
						<meta property="og:image:height" content="1600" />
						{/* this tag can be removed */}
						<meta property="og:image:alt" content="My custom alt" />
					</Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(
			actual?.replace(/\s/gm, ''),
			expected?.replace(/\s/gm, ''),
		);
	});

	it('should support twitter meta tags', function (this: Context) {
		const beforeText = `
	  import Head from 'next/head';
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

		const afterText = `
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
						{/* this tag can be removed */}
						<meta name="twitter:card" content="summary_large_image" />
						{/* this tag can be removed */}
						<meta name="twitter:title" content="Next.js" />
						{/* this tag can be removed */}
						<meta name="twitter:description" content="The React Framework for the Web" />
						{/* this tag can be removed */}
						<meta name="twitter:site:id" content="1467726470533754880" />
						{/* this tag can be removed */}
						<meta name="twitter:creator" content="@nextjs" />
						{/* this tag can be removed */}
						<meta name="twitter:creator:id" content="1467726470533754880" />
					</Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(
			actual?.replace(/\s/gm, ''),
			expected?.replace(/\s/gm, ''),
		);
	});

	it('should replace "other" metatags', function (this: Context) {
		const beforeText = `
	  import Head from 'next/head';
	  export default function Page() {
	    return (
	      <>
	        <Head>
						<meta name="msapplication-TileColor" content="#000000" />
						<meta name="msapplication-config" content="/favicon/browserconfig.xml" />
	        </Head>
	      </>
	    );
	  }
		`;

		const afterText = `
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
	      <>
	        <Head>
						{/* this tag can be removed */}
						<meta name="msapplication-TileColor" content="#000000" />
						{/* this tag can be removed */}
						<meta name="msapplication-config" content="/favicon/browserconfig.xml" />
					</Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(
			actual?.replace(/\s/gm, ''),
			expected?.replace(/\s/gm, ''),
		);
	});

	it('should support basic metadata', function (this: Context) {
		const beforeText = `
	  import Head from 'next/head';
		const var1 = 1;
		const var2 = 1;
		const var3 = 1;
		const var4 = 1;
		const var5 = 1;
		const var6 = 1;
		const var7 = 1;
		const var8 = 1;
		const var9 = 1;
		const var10 = 1;
		const var11 = 1;
		const var12 = 1;
		const var13 = 1;
		const var14 = 1;
		const var15 = 1;
		const var16 = 1;
		const var17 = 1;
		const var18 = 1;
		const var19 = 1;
		const var20 = 1;
		const var21 = 1;
		const var22 = 1;
		const var23 = 1;
		const var24 = 1;
	  export default function Page() {
	    return (
	      <>
	        <Head>
							<title>{var1}</title>
							<meta name="description" content={var2} />
							<meta name="application-name" content={var3} />
							<meta name="author" content={var4} />
							<link rel="author" href={var5} />
							<meta name="author" content={var6}/>
							<link rel="manifest" href={var7} />
							<meta name="generator" content={var8} />
							<meta name="keywords" content={var9} />
							<meta name="referrer" content={var10} />
							<meta name="theme-color" media="(prefers-color-scheme: light)" content={var11} />
							<meta name="theme-color" media="(prefers-color-scheme: dark)" content={var12} />
							<meta name="theme-color" content="#000" />
							<meta name="color-scheme" content={var13} />
							<meta name="viewport" content={var14} />
							<meta name="creator" content={var15} />
							<meta name="publisher" content={var16} />
							<meta name="robots" content={var17} />
							<meta name="googlebot" content={var18} />
							<meta name="abstract" content={var19} />
							<link rel="archives" href={var20} />
							<link rel="assets" href={var21} />
							<link rel="bookmarks" href={var22}/>
							<meta name="category" content={var23} />
							<meta name="classification" content={var24} />
	        </Head>
	      </>
	    );
	  }
		`;

		const afterText = `
	  import { Metadata } from "next";
		import Head from 'next/head';
	  export const metadata: Metadata = { 
			title: \`\${var1}\`, 
			description: var2, 
			applicationName: var3, 
			authors:  [{ name: var4, url: var5, }, { name: var6, }],
			manifest: var7, 
			generator: var8, 
			keywords: var9, 
			referrer: var10, 
			themeColor: [
				{ media: "(prefers-color-scheme: light)", color: var11, },
				{ media: "(prefers-color-scheme: dark)", color: var12, },
				{ color: "#000", }
			],
			colorScheme: var13, 
			viewport: var14, 
			creator: var15, 
			publisher: var16, 
			robots: var17, 
			abstract: var19, 
			archives: [var20],
			assets: [var21],
			bookmarks: [var22], 
			category: var23, 
			classification: var24,
		};
		const var1 = 1;
		const var2 = 1;
		const var3 = 1;
		const var4 = 1;
		const var5 = 1;
		const var6 = 1;
		const var7 = 1;
		const var8 = 1;
		const var9 = 1;
		const var10 = 1;
		const var11 = 1;
		const var12 = 1;
		const var13 = 1;
		const var14 = 1;
		const var15 = 1;
		const var16 = 1;
		const var17 = 1;
		const var18 = 1;
		const var19 = 1;
		const var20 = 1;
		const var21 = 1;
		const var22 = 1;
		const var23 = 1;
		const var24 = 1;
		
		export default function Page() {
	    return (
	      <>
	        <Head>
						{/* this tag can be removed */}
						<title>{var1}</title>
						{/* this tag can be removed */}
						<meta name="description" content={var2} />
						{/* this tag can be removed */}
						<meta name="application-name" content={var3} />
						{/* this tag can be removed */}
						<meta name="author" content={var4} />
						{/* this tag can be removed */}
						<link rel="author" href={var5} />
						{/* this tag can be removed */}
						<meta name="author" content={var6}/>
						{/* this tag can be removed */}
						<link rel="manifest" href={var7} />
						{/* this tag can be removed */}
						<meta name="generator" content={var8} />
						{/* this tag can be removed */}
						<meta name="keywords" content={var9} />
						{/* this tag can be removed */}
						<meta name="referrer" content={var10} />
						{/* this tag can be removed */}
						<meta name="theme-color" media="(prefers-color-scheme: light)" content={var11} />
						{/* this tag can be removed */}
						<meta name="theme-color" media="(prefers-color-scheme: dark)" content={var12} />
						{/* this tag can be removed */}
						<meta name="theme-color" content="#000" />
						{/* this tag can be removed */}
						<meta name="color-scheme" content={var13} />
						{/* this tag can be removed */}
						<meta name="viewport" content={var14} />
						{/* this tag can be removed */}
						<meta name="creator" content={var15} />
						{/* this tag can be removed */}
						<meta name="publisher" content={var16} />
						{/* this tag can be removed */}
						<meta name="robots" content={var17} />
						<meta name="googlebot" content={var18} />
						{/* this tag can be removed */}
						<meta name="abstract" content={var19} />
						{/* this tag can be removed */}
						<link rel="archives" href={var20} />
						{/* this tag can be removed */}
						<link rel="assets" href={var21} />
						{/* this tag can be removed */}
						<link rel="bookmarks" href={var22}/>
						{/* this tag can be removed */}
						<meta name="category" content={var23} />
						{/* this tag can be removed */}
						<meta name="classification" content={var24} />
					</Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(
			actual?.replace(/\s/gm, ''),
			expected?.replace(/\s/gm, ''),
		);
	});

	it('should not move tag, if its attributes has variables that are not defined in top level scope', function (this: Context) {
		const beforeText = `
	  import Head from "next/head";
		import { var5 } from "module";
		import * as var6 from "module";
		import var7 from "module";
		const var1 = 1;
		const var2 = 2, var3 = 3;
		const var4 = () => {};
		const varobj1 = {}
		
	  export default function Page() {
			const { t } = useHook();
			const var1 = 1;
	    return (
	      <>
	        <Head>
						<meta name="description" content={t("quick_video_meeting")} />
						<meta name="creator" content={var1} />
						<meta name="description" content={var2 + var3} />
						<meta name="creator" content={varobj.prop} />
						<meta name="referrer" content={varobj1.prop} />
	        </Head>
	      </>
	    );
	  }
		`;

		const afterText = `
	  import { Metadata } from "next";
		import Head from "next/head";
		import { var5 } from "module";
		import * as var6 from "module";
		import var7 from "module";
		export const metadata: Metadata = { 
			description: var2 + var3, 
			referrer: varobj1.prop,
		};
		
		const var1 = 1;
		const var2 = 2, var3 = 3;
		const var4 = () => {};
		const varobj1 = {}
	 
		export default function Page() {
			const { t } = useHook();
			const var1 = 1;
	    return (
	      <>
				<Head>
					{/* this tag cannot be removed, because it uses variables from inner scope */}
					<meta name="description" content={t("quick_video_meeting")} />
					{/* this tag cannot be removed, because it uses variables from inner scope */}
					<meta name="creator" content={var1} />
					{/* this tag can be removed */}
					<meta name="description" content={var2 + var3} />
					{/* this tag cannot be removed, because it uses variables from inner scope */}
					<meta name="creator" content={varobj.prop} />
					{/* this tag can be removed */}
					<meta name="referrer" content={varobj1.prop} />
     		</Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(
			actual?.replace(/\s/gm, ''),
			expected?.replace(/\s/gm, ''),
		);
	});
});
