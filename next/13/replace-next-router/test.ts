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

describe('next 13 replace-next-router', function () {
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
	          const x = searchParams?.get("a");
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
				const a = searchParams?.get("a");
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
	              const a = searchParams?.get('a');
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
				const a = searchParams?.get('a');
			}
			`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace "...?.query" with "Object.fromEntries(...)"', async function (this: Context) {
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

				const shallowCopiedQuery = { ...Object.fromEntries(searchParams ?? new URLSearchParams()) };
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

				const a = searchParams?.get("a");
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
	              const a = searchParams?.get("a");
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

				const x = searchParams?.get("a");

				const z = { ...Object.fromEntries(searchParams ?? new URLSearchParams()), b: 1 };
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace router.query.a with searchParams?.get("a")', async function (this: Context) {
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
					() => (searchParams?.get("a") ? null : searchParams?.get("b")),
					[searchParams?.get("a"), searchParams?.get("b"), c],
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

				const { a, b, c } = Object.fromEntries(searchParams?.entries() ?? []);
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

	it('should replace { a } = query with a = searchParams?.get("a")', async function (this: Context) {
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
				const a = searchParams?.get("a");
				const b = searchParams?.get("b");
				const c = searchParams?.get("c");
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

	it('should replace router.isReady with useSearchParams in variable declaration', async function (this: Context) {
		const beforeText = `
	          import { useRouter } from 'next/router';

	          function Component() {
	              const router = useRouter();
	              const ready = router.isReady;
	          }
	      `;
		const afterText = `
			import { useSearchParams } from "next/navigation";

			function Component() {
				const searchParams = useSearchParams();

	            const ready = searchParams !== null;
			}
	      `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace router.isReady with useSearchParams in ternary variable assignment', async function (this: Context) {
		const beforeText = `
	          import { useRouter } from 'next/router';

	          function Component() {
	              const router = useRouter();
				  const ready = router.isReady ? true : false;
	          }
	      `;
		const afterText = `
			import { useSearchParams } from "next/navigation";

			function Component() {
				const searchParams = useSearchParams();
				const ready = searchParams !== null ? true : false;
			}
	      `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace !router.isReady with useSearchParams in variable declaration', async function (this: Context) {
		const beforeText = `
	          import { useRouter } from 'next/router';

	          function Component() {
	              const router = useRouter();
	              const notReady = !router.isReady;
	          }
	      `;
		const afterText = `
			import { useSearchParams } from "next/navigation";

			function Component() {
				const searchParams = useSearchParams();
	            const notReady = searchParams === null;
			}
	      `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace !router.isReady with useSearchParams in ternary variable assignment', async function (this: Context) {
		const beforeText = `
	          import { useRouter } from 'next/router';

	          function Component() {
	              const router = useRouter();
				  const ready = !router.isReady ? false : true;
	          }
	      `;
		const afterText = `
			import { useSearchParams } from "next/navigation";

			function Component() {
				const searchParams = useSearchParams();
				const ready = searchParams === null ? false : true;
			}
	      `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace !router.isReady with useSearchParams in `if` statement', async function (this: Context) {
		const beforeText = `
	          import { useRouter } from 'next/router';

	          function Component() {
	              const router = useRouter();
				  if (!router.isReady) {
					return null;
				  }
	          }
	      `;
		const afterText = `
			import { useSearchParams } from "next/navigation";

			function Component() {
				const searchParams = useSearchParams();
				if (searchParams === null) {
					return null;
				}
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
			import { useSearchParams } from "next/navigation";

	        function Component() {
				const searchParams = useSearchParams();

				const ready = searchParams !== null;
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
			import { useSearchParams } from "next/navigation";

			function Component() {
				const searchParams = useSearchParams();

				const ready = searchParams !== null;
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

				if (searchParams?.get('a') && searchParams?.get('b')) {

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
				const a = searchParams?.get(A);
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
				const b = searchParams?.get("a");
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

	it('should replace router.asPath with pathname', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			export function Component() {
				const router = useRouter();

				return <b>{router.asPath}</b>;
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
					<div>
						{query.a}
					</div>
				)
			}
		`;

		const afterText = `
			import { useSearchParams } from "next/navigation";

			export default function DynamicRoutes() {
				const searchParams = useSearchParams();

				return (
					<div>
						{searchParams?.get('a')}
					</div>
				)
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.js');

		deepStrictEqual(actual, expected);
	});

	it('should replace useRouter().query with ...Object.fromEntries(searchParams ?? new URLSearchParams())', () => {
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
						<div>{JSON.stringify(...Object.fromEntries(searchParams ?? new URLSearchParams())}</div>
					</>
				)
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.js');

		deepStrictEqual(actual, expected);
	});

	it('should replace router.isReady, router.asPath, router.href with proper replacements', () => {
		const beforeText = `
			import { useRouter } from 'next/router'
			import { useEffect } from 'react'

			function Component() {
				const router = useRouter();

				const [path,] = useState(
					router.isReady ? router.asPath : router.href
				);

				return null;
			}
		`;

		const afterText = `
			import { usePathname } from "next/navigation";
			import { useSearchParams } from "next/navigation";
			import { useEffect } from 'react';

			function Component() {
				const searchParams = useSearchParams();
				const pathname = usePathname();

				const [path,] = useState(searchParams !== null ? pathname : pathname);

				return null;
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.js');

		deepStrictEqual(actual, expected);
	});

	it('should replace useRouter().isFallback with false', () => {
		const beforeText = `
			import { useRouter } from 'next/router';

			export default function Component(props) {
				if (useRouter().isFallback) {
					return null;
				}

				return <div></div>;
			}
		`;

		const afterText = `
			export default function Component(props) {
				if (false) {
					return null;
				}

				return <div></div>;
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.js');

		deepStrictEqual(actual, expected);
	});

	it('should replace router.isFallback with false', () => {
		const beforeText = `
			import { useRouter } from 'next/router'

			const Component = () => {
		  		const router = useRouter()

		  		if (router.isFallback) {
		    		return null;
		  		}

				return null;
			}
		`;

		const afterText = `
			const Component = () => {
				if (false) {
					return null;
				}

				return null;
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.js');

		deepStrictEqual(actual, expected);
	});

	it('should retain the useRouter import when router is in use', () => {
		const beforeText = `
			import { useRouter } from 'next/router'

			const Component = () => {
		  		const router = useRouter()

				React.useEffect(
					() => {

					},
					[router]
				)

				const a = router.pathname.includes('a')

				return null;
			}
		`;

		const afterText = `
			import { usePathname } from "next/navigation";
			import { useRouter } from "next/navigation"

			const Component = () => {
	   			const pathname = usePathname();
	   			const router = useRouter();

				React.useEffect(
					() => {
					},
					[router]
				);

	   			const a = pathname?.includes('a');
			return null;
		};

		`;

		const { actual, expected } = transform(beforeText, afterText, '.js');

		deepStrictEqual(actual, expected);
	});

	it('should use searchParams when dealing with function(query)', () => {
		const beforeText = `
			import { useRouter } from 'next/router'

			const Component = () => {
		  		const { query } = useRouter()

				return JSON.stringify(query);
			}
		`;

		const afterText = `
			import { useSearchParams } from "next/navigation";

			const Component = () => {
				const searchParams = useSearchParams();
				return JSON.stringify(searchParams);
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.js');

		deepStrictEqual(actual, expected);
	});

	it('should use searchParams when dealing with function(query)', () => {
		const beforeText = `
			import { useRouter } from 'next/router'

			const Component = () => {
		  		const { locale } = useRouter()

				return null;
			}
		`;

		const afterText = `
			const Component = () => {
				return null;
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.js');

		deepStrictEqual(actual, expected);
	});

	it('should replace router.asPath.startsWith with pathname?.startsWith', () => {
		const beforeText = `
			import { useRouter } from "next/router";

			export default function Component() {
		  		const router = useRouter();

				useEffect(
					() => {
						router.replace("a");
					},
					[router]
				);

				const a = router.asPath.startsWith("a");

				return null;
			}
		`;

		const afterText = `
			import { usePathname } from "next/navigation";
			import { useRouter } from "next/navigation";

			export default function Component() {
				const pathname = usePathname();
				const router = useRouter();

				useEffect(
					() => {
						router.replace("a");
					},
					[router]
				);

				const a = pathname?.startsWith("a");

				return null;
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace "{ asPath } = useRouter()" with "pathname = usePathname()"', () => {
		const beforeText = `
			import { useRouter } from "next/router";

			export default function Component() {
				const { asPath } = useRouter();

				const a = asPath.startsWith("a");

				return null;
			}
		`;

		const afterText = `
			import { usePathname } from "next/navigation";

			export default function Component() {
				const pathname = usePathname();

				const a = pathname?.startsWith("a");

				return null;
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace "path = useRouter().asPath" with "path = usePathname()"', () => {
		const beforeText = `
			import { useRouter } from "next/router";

			export default function Component() {
				const path = useRouter().asPath;

				const a = path.startsWith("a");

				return null;
			}
		`;

		const afterText = `
			import { usePathname } from "next/navigation";

			export default function Component() {
				const path = usePathname();

				const a = path?.startsWith("a");

				return null;
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace "router.query[name]" with "searchParams?.get(name)"', () => {
		const beforeText = `
			import { useRouter } from "next/router";

			export default function Component() {
				const router = useRouter();

				const param = router.query["param"];

				return null;
			}
		`;

		const afterText = `
			import { useSearchParams } from "next/navigation";

			export default function Component() {
				const searchParams = useSearchParams();

				const param = searchParams?.get("param");

				return null;}
				`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace "router.replace({pathname: string})" with "router.replace(href: string)"', () => {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const router = useRouter();
				router.replace({
					pathname: "/auth/login",
				});
			}
	  	`;

		const afterText = `
	  		import { useRouter } from "next/navigation";

			function Component() {
				const router = useRouter();
				router.replace("/auth/login");
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace "router.replace({pathname: string, query: {...})" with "router.replace(href: string)"', () => {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const router = useRouter();
				router.replace({
					pathname: "/auth/login",
					query: {
					  callbackUrl: \`/apps/\${slug}/setup\`,
					},
				});
			}
	  	`;

		const afterText = `
	  		import { useRouter } from "next/navigation";

			function Component() {
				const router = useRouter();
				const urlSearchParams = new URLSearchParams()
				urlSearchParams.set('callbackUrl', \`/apps/\${slug}/setup\`);
				router.replace(\`/auth/login?\${urlSearchParams.toString()}\`);
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace "router.push({pathname: string})" with "router.push(href: string)"', () => {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const router = useRouter();
				router.push({
					pathname: "/auth/login",
				});
			}
	  	`;

		const afterText = `
	  		import { useRouter } from "next/navigation";

			function Component() {
				const router = useRouter();
				router.push("/auth/login");
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace useRouter import when push is destructured', () => {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const { push } = useRouter();
				push("/auth/login");
			}
	  	`;

		const afterText = `
	  		import { useRouter } from "next/navigation";

			function Component() {
				const { push } = useRouter();
				push("/auth/login");
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace useRouter import when push is destructured  2', () => {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const { push } = useRouter();
				push({
					pathname: '/auth/login',
					query: {
					  callbackUrl: \`/apps/\${slug}/setup\`,
						param: var1, 
						param1: fn(),
					},
				});
			}
	  	`;

		const afterText = `
	  		import { useRouter } from "next/navigation";

			function Component() {
				const { push } = useRouter();
				const urlSearchParams = new URLSearchParams();
				urlSearchParams.set('callbackUrl', \`/apps/\${slug}/setup\`);
				urlSearchParams.set('param', var1);
				urlSearchParams.set('param1', fn());
				push(\`/auth/login?\${urlSearchParams.toString()}\`);
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace "router.push({pathname: string, query: {...})" with "router.push(href: string)"', () => {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const router = useRouter();
				router.push({
					pathname: '/auth/login',
					query: {
					  callbackUrl: \`/apps/\${slug}/setup\`,
						param: var1, 
						param1: fn(),
					},
				});
			}
	  	`;

		const afterText = `
	  		import { useRouter } from "next/navigation";

			function Component() {
				const router = useRouter();
				const urlSearchParams = new URLSearchParams();
				urlSearchParams.set('callbackUrl', \`/apps/\${slug}/setup\`);
				urlSearchParams.set('param', var1);
				urlSearchParams.set('param1', fn());
				router.push(\`/auth/login?\${urlSearchParams.toString()}\`);
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should handle "const { query: { rescheduleUid } = {} } = useRouter();"', () => {
		const beforeText = `
			import { useRouter } from "next/router";

			export default function Component() {
				const { query: { param1, param2 } = {} } = useRouter();

				return null;
			}
		`;

		const afterText = `
			import { useSearchParams } from "next/navigation";

			export default function Component() {
				const searchParams = useSearchParams();

				const param1 = searchParams?.get("param1");
				const param2 = searchParams?.get("param2");

				return null;}
				`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should remove await from "await router.push(href: string)"', () => {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const router = useRouter();
				const handleRouting = async () => {
					await router.push('/auth/login');
				};
			}
	  	`;

		const afterText = `
	  		import { useRouter } from "next/navigation";
		
			function Component() {
				const router = useRouter();
				const handleRouting = async () => {
					router.push('/auth/login');
				};
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should remove await from "await router.replace(href: string)"', () => {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const router = useRouter();
				const handleRouting = async () => {
					await router.replace('/auth/login');
				};
			}
	  	`;

		const afterText = `
	  		import { useRouter } from "next/navigation";
		
			function Component() {
				const router = useRouter();
				const handleRouting = async () => {
					router.replace('/auth/login');
				};
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should replace NextRouter with AppRouterInstance', () => {
		const beforeText = `
			import type { NextRouter } from "next/router"; 
			function(router: NextRouter) {}
		`;

		const afterText = `
			import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context";
			function(router: AppRouterInstance) {}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should support rest operator "{ p1, p2, ...r } = r.query"', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const r = useRouter();
				const { p1: param1, p2, ...r } = r.query;
				
			}
		`;

		const afterText = `
	    import { useSearchParams } from "next/navigation";

			function Component() {
				const searchParams = useSearchParams();

				const { p1: param1, p2, ...r} = Object.fromEntries(searchParams?.entries() ?? []);
			}
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should support call expression parent node', () => {
		const beforeText = `
			import { useRouter } from 'next/router';

			function() {
				const router = useRouter();
				const { id: orgId } = querySchema.parse(router.query);
			}
		`;

		const afterText = `
			import { useSearchParams } from "next/navigation";

			function() {
				const searchParams = useSearchParams();
				const { id: orgId } = querySchema.parse(...Object.fromEntries(searchParams ?? new URLSearchParams()));
			}
		`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should ensure that `useRouter` import is updated', () => {
		const beforeText = `
		import { useRouter } from "next/router";
		
		function Test() {
		  const router = useRouter();
		  const x = router;
		}
	`;

		const afterText = `
		import { useRouter } from "next/navigation";
		
		function Test() {
		  const router = useRouter();
		  const x = router;
		}
	`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it('should ensure that `useRouter` import is added when `router` is used as a short-hand property', () => {
		const beforeText = `
		import { useRouter } from "next/router";
		
		export default function CustomThemeProvider() {
		  const router = useRouter();

		  return (
			<ThemeProvider {...getThemeProviderProps({ props, router })} />
		  );
		}
	`;

		const afterText = `
		import { useRouter } from "next/navigation";
		
		export default function CustomThemeProvider() {
		  const router = useRouter();
		
		  return (
			<ThemeProvider {...getThemeProviderProps({ props, router })} />
		  );
		}
	`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});

	it("should transform usages of the query property of the router's binding element", () => {
		const beforeText = `
		import { useState, useEffect } from 'react';
		import { useRouter } from 'next/router';

		export default function useX(): void {
			const router = useRouter();
			const { query } = router;

			useEffect(
				() => {
					if (!router.isReady) {
						return;
					}

					if (query.a === 'a') {
						return;
					}

					if (typeof query.a === 'undefined') {
						return;
					}
				},
				[query, router]
			);
		}
		`;

		const afterText = `
		import { useSearchParams } from "next/navigation";
		import { useRouter } from "next/navigation";
		import { useState, useEffect } from 'react';

		export default function useX(): void {
			const searchParams = useSearchParams();
			const router = useRouter();
			
			useEffect(() => {
				if (searchParams === null) {
					return;
				}
				if (searchParams?.get("a") === 'a') {
					return;
				}
				if (typeof searchParams?.get("a") === 'undefined') {
					return;
				}
			}, [searchParams, router]);
		}`;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});
});
