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

describe.only('next 13 replace-next-router', function () {
	it('should add useSearchParams import because of "router.query"', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const router = useRouter();

				const x = router.query.a;
			}
		`;

		const afterText = `
        import { useSearchParams } from "next/navigation";

        function Component() {
            const searchParams = useSearchParams();
            const x = searchParams.get("a");
        }
        `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should add useSearchParams import because of "useRouter().query"', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const a = useRouter().query.a;
			}
		`;

		const afterText = `
			import { useSearchParams } from "next/navigation";

			function Component() {
                const searchParams = useSearchParams();
				const a = searchParams.get("a");
			}
        `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should add useSearchParams import because of "const { query } = useRouter()"', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const { query } = useRouter();

                const a = query.a;
			}
		`;

		const afterText = `
            import { useSearchParams } from "next/navigation";

			function Component() {
                const searchParams = useSearchParams();
                const a = searchParams.get('a');
			}
        `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should add searchParams variable declarator because of "useRouter()"', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const { query } = useRouter();

                const a = query.a;
			}
		`;

		const afterText = `
            import { useSearchParams } from "next/navigation";

			function Component() {
				const searchParams = useSearchParams();
				const a = searchParams.get('a');
			}
			`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace "...?.query" with "...searchParams.entries()."', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const r = useRouter();

				const shallowCopiedQuery = { ...r.query }
			}
		`;

		const afterText = `
            import { useSearchParams } from "next/navigation";

			function Component() {
				const searchParams = useSearchParams();

				const shallowCopiedQuery = { ...Object.fromEntries(searchParams) };
			}
			`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace "?.query" with "searchParams"', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const r = useRouter();

				const a = r.query.a;
			}
		`;

		const afterText = `
            import { useSearchParams } from "next/navigation";

			function Component() {
				const searchParams = useSearchParams();

				const a = searchParams.get("a");
			}
        `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace "useRouter().query" with "useSearchParams()"', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const a = useRouter().query.a;
			}
		`;

		const afterText = `
            import { useSearchParams } from "next/navigation";

			function Component() {
				const searchParams = useSearchParams();
                const a = searchParams.get("a");
			}
			`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace ...router.query with ...Object.fromEntries(searchParams)', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const router = useRouter();

				const x = router.query.a;

				const z = { ...router.query, b: 1 }
			}
		`;

		const afterText = `
            import { useSearchParams } from "next/navigation";

			function Component() {
				const searchParams = useSearchParams();

				const x = searchParams.get("a");

				const z = { ...Object.fromEntries(searchParams), b: 1 };
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace router.query.a with searchParams.get("a")', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			const a = 1;

			function Component() {
				const router = useRouter();

				const nextA = useMemo(
					() => (router.query.a ? null : router.query.b),
					[router.query.a, router.query.b, c],
				) ?? a;
			}
		`;

		const afterText = `
			import { useSearchParams } from "next/navigation";

			const a = 1;

			function Component() {
				const searchParams = useSearchParams()

				const nextA = useMemo(
					() => (searchParams.get("a") ? null : searchParams.get("b")),
					[searchParams.get("a"), searchParams.get("b"), c],
				) ?? a;
			}
		`;

		// TODO useMemo second parameter -> searchParams if at all

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace "query" with "searchParams"', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
                const router = useRouter();
				const { a, b, c } = router.query;
			}
		`;

		const afterText = `
			import { useSearchParams } from "next/navigation";

			function Component() {
                const searchParams = useSearchParams();

				const a = searchParams.get("a"),
                    b = searchParams.get("b"),
                    c = searchParams.get("c");
			}
        `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should delete query from destructured useRouter call', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const { query } = useRouter();
			}
		`;

		const afterText = `
			function Component() {
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should delete empty useRouter destructuring', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const { } = useRouter();
			}
		`;

		const afterText = `
			function Component() {

			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should remove unused useRouter import specifiers', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {

			}
		`;

		const afterText = `
			function Component() {

			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should not remove CSS imports', async function (this: Context) {
		const beforeText = `
			import './index.css';
		`;

		const afterText = `
			import './index.css';
		`;

		const { actual } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, undefined);
	});

	it('should replace { a } = query with a = searchParams.get("a")', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const { query } = useRouter();
				const { a, b, c } = query;
			}
		`;

		const afterText = `
			import { useSearchParams } from "next/navigation";

			function Component() {
				const searchParams = useSearchParams();
				const a = searchParams.get("a");
				const b = searchParams.get("b");
				const c = searchParams.get("c");
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace useRouter().pathname with usePathname()', async function (this: Context) {
		const beforeText = `
            import { useRouter } from 'next/router';
            
            function Component() {
                const pathname = useRouter().pathname;
            }
        `;
		const afterText = `
            import { usePathname} from "next/navigation";
            
            function Component() {
                const pathname = usePathname();
            }
        `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace router.pathname with usePathname()', async function (this: Context) {
		const beforeText = `
            import { useRouter } from 'next/router';

            function Component() {
                const router = useRouter();
                const pathname = router.pathname;
            }
        `;

		const afterText = `
			import { usePathname } from "next/navigation";
            
            function Component() {
                const pathname = usePathname();
            }
        `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace { pathname } destructed from useRouter() with usePathname()', async function (this: Context) {
		const beforeText = `
            import { useRouter } from 'next/router';

            function Component() {
                const { pathname } = useRouter();
            }
        `;

		const afterText = `
			import { usePathname } from "next/navigation";

            function Component() {
                const pathname = usePathname();
            }
	    `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace { pathname } destructed from router with usePathname()', async function (this: Context) {
		const beforeText = `
            import { useRouter } from 'next/router';
            
            function Component() {
                const router = useRouter();

                const { pathname } = router;
            }
        `;

		const afterText = `
			import { usePathname } from "next/navigation";

            function Component() {
                const pathname = usePathname();
            }
        `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace { pathname: p } destructed from router with const p = usePathname()', async function (this: Context) {
		const beforeText = `
            import { useRouter } from 'next/router';

            function Component() {
                const router = useRouter();
                const { pathname: p } = router;
            }
        `;
		const afterText = `
            import { usePathname } from "next/navigation";
            
            function Component() {
                const p = usePathname();
            }
        `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace router.isReady with true', async function (this: Context) {
		const beforeText = `
            import { useRouter } from 'next/router';

            function Component() {
                const router = useRouter();
                const ready = router.isReady;
            }
        `;
		const afterText = `
            function Component() {
                const ready = true;
            }
        `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace useRouter().isReady with true', async function (this: Context) {
		const beforeText = `
            import { useRouter } from 'next/router';

            function Component() {
                const ready = useRouter().isReady;
            }
        `;
		const afterText = `
            function Component() {
                const ready = true;
            }
        `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should remove { isReady } and replace usages with true', async function (this: Context) {
		const beforeText = `
            import { useRouter } from 'next/router';

            function Component() {
                const { isReady } = useRouter();
				const ready = isReady;
            }
        `;

		const afterText = `
            function Component() {
                const ready = true;
            }
        `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should noop for already-existing import', async function (this: Context) {
		const beforeText = `
			import { usePathname } from 'next/navigation';

			function Component() {
				const pathname = usePathname();
			}
		`;

		const { actual } = transform(beforeText, beforeText, '.tsx');

		deepStrictEqual(actual, undefined);
	});

	it('should replace query.a if query comes from useRouter return value destructurizing', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			export function Component() {
				const { query } = useRouter();

				if (query.a && query.b) {

				}
			}
		`;

		const afterText = `
			import { useSearchParams } from "next/navigation";

			export function Component() {
				const searchParams = useSearchParams();

				if (searchParams.get('a') && searchParams.get('b')) {

				}
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace { route } = useRouter() with usePathname()', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			export function Component() {
				const { route, pathname } = useRouter();

				return route === 'test' && pathname === 'test';
			}
		`;

		const afterText = `
			import { usePathname } from "next/navigation";

			export function Component() {
				const route = usePathname();
				const pathname = usePathname();

				return route === 'test' && pathname === 'test';
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace useRouter().query[A] with useSearchParams', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			const A = 'constant';

			export function Component() {
				const a = useRouter().query[A];
			}
		`;

		const afterText = `
			import { useSearchParams } from "next/navigation";

			const A = 'constant';

			export function Component() {
				const searchParams = useSearchParams();
				const a = searchParams.get(A);
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace useRouter().query as A with useSearchParams', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			export function Component() {
				const { a: b } = useRouter().query as A;
			}
		`;

		const afterText = `
			import { useSearchParams } from "next/navigation";

			export function Component() {
				const searchParams = useSearchParams();
				const b = searchParams.get("a");
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace router.pathname with pathname', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			export function Component() {
				const router = useRouter();

				return <b>{router.pathname}</b>;
			}
		`;

		const afterText = `
			import { usePathname } from "next/navigation";

			export function Component() {
				const pathname = usePathname();

				return <b>{pathname}</b>;
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace router.asPath with pathname and searchParams', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			export function Component() {
				const router = useRouter();

				return <b>{router.asPath}</b>;
			}
		`;

		const afterText = `
			import { usePathname } from "next/navigation";
			import { useSearchParams } from "next/navigation";

			export function Component() {
				const searchParams = useSearchParams();
				const pathname = usePathname();

				return <b>{\`\${pathname}?\${searchParams}\`}</b>;
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should switch the useRouter import source to next/router for router.push', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			export function Component() {
				const router = useRouter();

				useEffect(() => {
					router.push('/);
				})
			}
		`;

		const afterText = `
			import { useRouter } from "next/navigation";

			export function Component() {
				const router = useRouter();

				useEffect(() => {
					router.push('/);
				})
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should transform usages within a JS default function', () => {
		const beforeText = `
			import { useRouter } from 'next/router';

			export default function DynamicRoutes() {
				const { query } = useRouter();
				return (
					<main>
						{query.routeName}
					</main>
				)
			}
		`;

		const afterText = `
			import { useSearchParams } from "next/navigation";	

			export default function DynamicRoutes() {
				const searchParams = useSearchParams();

				return (
					<main>
						{searchParams.get('routeName')}
					</main>
				)
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.js');

		deepStrictEqual(actual, expected);
	});

	it('should transform usages within a JS default function (useRouter().query)', () => {
		const beforeText = `
			import React from 'react'
			import { useRouter } from 'next/router'

			export default () => {
				return (
					<>
						<div>{JSON.stringify(useRouter().query)}</div>
					</>
				)
			}
		`;

		const afterText = `
			import { useSearchParams } from "next/navigation";
			import React from 'react'

			export default () => {
				const searchParams = useSearchParams();

				return (
					<>
						<div>{JSON.stringify(...Object.fromEntries(searchParams)}</div>
					</>
				)
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.js');

		deepStrictEqual(actual, expected);
	});

	it('should transform usages within a JS default function (router.isPath', () => {
		const beforeText = `
			import { useRouter } from 'next/router'
			import { useEffect } from 'react'
			
			export default function Page(props) {
				const router = useRouter();
				
				const [path, setPath] = useState(
					router.isReady ? router.asPath : router.href
				);

				useEffect(() => {
					if (router.isReady) {
						setAsPath(router.asPath)
					}
				}, [router.asPath, router.isReady])
				return (
					<>
					<p>{JSON.stringify(router.query)}</p>
					<p>{router.pathname}</p>
					</>
				)
			}
		`;

		/**
		 * In addition, the new useRouter hook has the following changes:

    isFallback has been removed because fallback has been replaced.
    The locale, locales, defaultLocales, domainLocales values have been removed
	because built-in i18n Next.js features are no longer necessary in the app directory. We will document a comprehensive example of how to achieve i18n using nested routing and generateStaticParams in the coming weeks.
    basePath has been removed. The alternative will not be part of useRouter. It has not yet been implemented.
    asPath has been removed because the concept of as has been removed from the new router.
    isReady has been removed because it is no longer necessary. During static rendering, any component that uses the useSearchParams() hook will skip the prerendering step and instead be rendered on the client at runtime
		 */

		const afterText = `
			
		`;

		const { actual, expected } = transform(beforeText, afterText, '.js');

		deepStrictEqual(actual, expected);
	});

	// 		```export default function Page(props) {
	// 	if (useRouter().isFallback) {
	// 	  return <p>Loading...</p>
	// 	}
	// 	return (
	// 	  <>
	// 		<p id="props">{JSON.stringify(props)}</p>
	// 		<Link href="/fallback-true-blog/first?hello=world" shallow id="to-query-shallow">
	// 		  to /fallback-true-blog/first?hello=world
	// 		</Link>
	// 		<br />
	// 		<Link href="/fallback-true-blog/second" shallow id="to-no-query-shallow">
	// 		  to /fallback-true-blog/second
	// 		</Link>
	// 		<br />
	// 	  </>
	// 	)
	//   }```;

	// 		```
	//   import { useRouter } from 'next/router'
	// import Link from 'next/link'
	// const Show = ({ show, time }) => {
	//   const router = useRouter()
	//   if (router.isFallback) {
	//     return <div>Loading...</div>
	//   }
	//   ```;
});
