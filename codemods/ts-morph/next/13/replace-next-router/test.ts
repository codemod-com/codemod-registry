import { Context } from 'mocha';
import { handleSourceFile } from '.';
import { Project } from 'ts-morph';
import { deepStrictEqual } from 'node:assert';

const transform = (beforeText: string, afterText: string) => {
	const project = new Project({ useInMemoryFileSystem: true });

	const actualSourceFile = project.createSourceFile('actual.tsx', beforeText);
	const actual = handleSourceFile(actualSourceFile);

	const expected = project
		.createSourceFile('expected.tsx', afterText)
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

		const { actual, expected } = transform(beforeText, afterText);

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

		const { actual, expected } = transform(beforeText, afterText);

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

		const { actual, expected } = transform(beforeText, afterText);

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

		const { actual, expected } = transform(beforeText, afterText);

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

		const { actual, expected } = transform(beforeText, afterText);

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

		const { actual, expected } = transform(beforeText, afterText);

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

		const { actual, expected } = transform(beforeText, afterText);

		deepStrictEqual(actual, expected);
	});

	it('should replace INPUT with OUTPUT', async function (this: Context) {
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

		const { actual, expected } = transform(beforeText, afterText);

		deepStrictEqual(actual, expected);
	});

	it('should replace INPUT with OUTPUT (2)', async function (this: Context) {
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

		const { actual, expected } = transform(beforeText, afterText);

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

		const { actual, expected } = transform(beforeText, afterText);

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

		const { actual, expected } = transform(beforeText, afterText);

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

		const { actual, expected } = transform(beforeText, afterText);

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

		const { actual, expected } = transform(beforeText, afterText);

		deepStrictEqual(actual, expected);
	});

	it('should not remove CSS imports', async function (this: Context) {
		const beforeText = `
			import './index.css';
		`;

		const afterText = `
			import './index.css';
		`;

		const { actual } = transform(beforeText, afterText);

		deepStrictEqual(actual, undefined);
	});

	it('should replace INPUT with OUTPUT (3)', async function (this: Context) {
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

		const { actual, expected } = transform(beforeText, afterText);

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

		const { actual, expected } = transform(beforeText, afterText);

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

		const { actual, expected } = transform(beforeText, afterText);

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

		const { actual, expected } = transform(beforeText, afterText);

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

		const { actual, expected } = transform(beforeText, afterText);

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

		const { actual, expected } = transform(beforeText, afterText);

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

		const { actual, expected } = transform(beforeText, afterText);

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

		const { actual, expected } = transform(beforeText, afterText);

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

		const { actual, expected } = transform(beforeText, afterText);

		deepStrictEqual(actual, expected);
	});

	it('should noop for already-existing import', async function (this: Context) {
		const beforeText = `
			import { usePathname } from 'next/navigation';

			function Component() {
				const pathname = usePathname();
			}
		`;

		const { actual } = transform(beforeText, beforeText);

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

		const { actual, expected } = transform(beforeText, afterText);

		deepStrictEqual(actual, expected);
	});

	it('test', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			export function Component() {
				const { route, pathname } = useRouter();

				return route === 'test && pathname === 'test;
			}
		`;

		const afterText = `
			import { usePathname } from "next/navigation";
			import { useRouter } from "next/navigation";

			export function Component() {
				const { route } = useRouter();
				const pathname = usePathname();

				return route === 'test && pathname === 'test;
			}
		`;

		const { actual, expected } = transform(beforeText, afterText);

		deepStrictEqual(actual, expected);
	});

	it('test', async function (this: Context) {
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

		const { actual, expected } = transform(beforeText, afterText);

		deepStrictEqual(actual, expected);
	});

	//

	// const { a: b } = useRouter().query as { ... }

	// const isPreview = useRouter().isPreview;

	// const {
	// 		query: { a },
	// 	} = useRouter();
});
