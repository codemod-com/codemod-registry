import { Context } from 'mocha';
import { handleSourceFile } from '.';
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
    export const metadata: Metadata = { 
			title: \`My page title\`,
		};
    export default function Page() {
      return (
        <>
          <Head>
            
          </Head>
        </>
      );
    }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(actual, expected);
	});

	it('should replace title tag - jsxExpression', function (this: Context) {
		const beforeText = `
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
    export const metadata: Metadata = { 
			title: \`\${process.env.VAR}\`,
		};
    export default function Page() {
      return (
        <>
          <Head>
					
          </Head>
        </>
      );
    }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(actual, expected);
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
    export const metadata: Metadata = { 
			title: \`My page title \${process.env.VAR}\`,
		};
    export default function Page() {
      return (
        <>
          <Head>
					
          </Head>
        </>
      );
    }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(actual, expected);
	});

	it('should replace title tag - jsxExpression 3', function (this: Context) {
		const beforeText = `
    import Head from 'next/head';
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
    export const metadata: Metadata = { 
			title: \`\${var1} text \${fn()} text2 \${var3 ? "literal1": var4}\`,
		};
    export default function Page() {
      return (
        <>
          <Head>
					
          </Head>
        </>
      );
    }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(actual, expected);
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
	  export const metadata: Metadata = { 
			viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
		};
		export default function Page() {
	    return (
	      <>
	        <Head>
						
	        </Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(actual, expected);
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
	  export const metadata: Metadata = { 
			description: process.env.VAR,
		};
		export default function Page() {
	    return (
	      <>
	        <Head>
						
	        </Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(actual, expected);
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
						
						
						
						
							
	        </Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(actual, expected);
	});

	it('should support icons meta tags', function (this: Context) {
		const beforeText = `
	  import Head from 'next/head';
	  export default function Page() {
	    return (
	      <>
	        <Head>
						<link rel="shortcut icon" href="/shortcut-icon.png" />
						<link rel="icon" href="/icon.png" />
						<link rel="apple-touch-icon" href="/apple-icon.png" />
	        </Head>
	      </>
	    );
	  }
		`;

		const afterText = `
	  import { Metadata } from "next";
	  export const metadata: Metadata = { 
			icons: {
				shortcut: "/shortcut-icon.png",
				icon: "/icon.png",
				apple: "/apple-icon.png",
			},
		};
		
		export default function Page() {
	    return (
	      <>
	        <Head>
						
						
						
	        </Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(actual, expected);
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
						
						
						
	        </Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(actual, expected);
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
						<meta property="og:image" content="https://nextjs.org/og.png" />
	        </Head>
	      </>
	    );
	  }
		`;

		const afterText = `
	  import { Metadata } from "next";
	  export const metadata: Metadata = { 
			openGraph: {
				title: "Next.js",
				description: "The React Framework for the Web",
				url: "https://nextjs.org/",
				siteName: "Next.js",
				locale: "en_US",
				type: "website",
				images: {
					url: "https://nextjs.org/og.png",
				},
			},
		};
		
		export default function Page() {
	    return (
	      <>
	        <Head>
						
						
						
						
						
						
	        </Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(actual, expected);
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
						
						
						
						
						
						
	        </Head>
	      </>
	    );
	  }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(actual, expected);
	});
});
