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
        import { useRouter } from "next/navigation";

        function Component() {
            const searchParams = useSearchParams();
            const x = searchParams.get("a");
        }
        `;

		const { actual, expected } = transform(beforeText, afterText);

		deepStrictEqual(actual, expected);
	});

	xit('should add useSearchParams import because of "useRouter().query"', async function (this: Context) {
		const beforeText = `
			import { useRouter } from 'next/router';

			function Component() {
				const a = useRouter().query.a;
			}
		`;

		const afterText = `
			import { useSearchParams } from 'next/navigation';
			import { useRouter } from 'next/router';

			function Component() {
				const a = useRouter().query.a;
			}
        `;

		const { actual, expected } = transform(beforeText, afterText);

		deepStrictEqual(actual, expected);
	});

	// it('should add useSearchParams import because of "const { query } = useRouter()"', async function (this: Context) {
	// 	const { jscodeshift } = this.buildApi('tsx');

	// 	const root = jscodeshift(`
	// 		import { useRouter } from 'next/router';

	// 		function Component() {
	// 			const { query } = useRouter();
	// 		}
	// 	`);

	// 	addUseSearchParamsImport(jscodeshift, root);

	// 	assert.deepEqual(
	// 		root?.toSource().replace(/\W/gm, '') ?? '',
	// 		`
	// 		import { useSearchParams } from 'next/navigation';
	// 		import { useRouter } from 'next/router';

	// 		function Component() {
	// 			const { query } = useRouter();
	// 		}
	// 		`.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should add searchParams variable declarator because of "useRouter()"', async function (this: Context) {
	// 	const { jscodeshift } = this.buildApi('tsx');

	// 	const root = jscodeshift(`
	// 		import { useRouter } from 'next/router';

	// 		function Component() {
	// 			const { query } = useRouter();
	// 		}
	// 	`);

	// 	addSearchParamsVariableDeclarator(jscodeshift, root);

	// 	assert.deepEqual(
	// 		root?.toSource().replace(/\W/gm, '') ?? '',
	// 		`
	// 		import { useRouter } from 'next/router';

	// 		function Component() {
	// 			const searchParams = useSearchParams();
	// 			const { query } = useRouter();
	// 		}
	// 		`.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should replace "...?.query" with "...searchParams.entries()."', async function (this: Context) {
	// 	const { jscodeshift } = this.buildApi('tsx');

	// 	const root = jscodeshift(`
	// 		import { useRouter } from 'next/router';

	// 		function Component() {
	// 			const r = useRouter();

	// 			const shallowCopiedQuery = { ...r.query }
	// 		}
	// 	`);

	// 	replaceTripleDotRouterQueryWithSearchParams(jscodeshift, root);

	// 	assert.deepEqual(
	// 		root?.toSource().replace(/\W/gm, '') ?? '',
	// 		`
	// 		import { useRouter } from 'next/router';

	// 		function Component() {
	// 			const r = useRouter();

	// 			const shallowCopiedQuery = { ...searchParams.entries() }
	// 		}
	// 		`.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should replace "?.query" with "searchParams"', async function (this: Context) {
	// 	const { jscodeshift } = this.buildApi('tsx');

	// 	const root = jscodeshift(`
	// 		import { useRouter } from 'next/router';

	// 		function Component() {
	// 			const r = useRouter();

	// 			const a = r.query.a;
	// 		}
	// 	`);

	// 	replaceRouterQueryWithSearchParams(jscodeshift, root);

	// 	assert.deepEqual(
	// 		root?.toSource().replace(/\W/gm, '') ?? '',
	// 		`
	// 		import { useRouter } from 'next/router';

	// 		function Component() {
	// 			const r = useRouter();

	// 			const a = searchParams.a;
	// 		}
	// 		`.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should replace "useRouter().query" with "useSearchParams()"', async function (this: Context) {
	// 	const { jscodeshift } = this.buildApi('tsx');

	// 	const root = jscodeshift(`
	// 		import { useRouter } from 'next/router';

	// 		function Component() {
	// 			const a = useRouter().query.a;
	// 		}
	// 	`);

	// 	replaceUseRouterQueryWithUseSearchParams(jscodeshift, root);

	// 	assert.deepEqual(
	// 		root?.toSource().replace(/\W/gm, '') ?? '',
	// 		`
	// 		import { useRouter } from 'next/router';

	// 		function Component() {
	// 			const a = useSearchParams().a;
	// 		}
	// 		`.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should replace "searchParams.a" with "searchParams.get("a")"', async function (this: Context) {
	// 	const { jscodeshift } = this.buildApi('tsx');

	// 	const root = jscodeshift(`
	// 		import { useSearchParams } from 'next/navigation';

	// 		function Component() {
	// 			const searchParams = useSearchParams();

	// 			const a = searchParams.a;
	// 		}
	// 	`);

	// 	replaceSearchParamsXWithSearchParamsGetX(jscodeshift, root);

	// 	assert.deepEqual(
	// 		root?.toSource().replace(/\W/gm, '') ?? '',
	// 		`
	// 		import { useSearchParams } from 'next/navigation';

	// 		function Component() {
	// 			const searchParams = useSearchParams();

	// 			const a = searchParams.get('a');
	// 		}
	// 		`.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should replace INPUT with OUTPUT', async function (this: Context) {
	// 	const INPUT = `
	// 		import { useRouter } from 'next/router';

	// 		function Component() {
	// 			const router = useRouter();

	// 			const x = router.query.a;

	// 			const z = { ...router.query, b: 1 }
	// 		}
	// 	`;

	// 	const OUTPUT = `
	// 		import { useSearchParams } from 'next/navigation';
	// 		import { useRouter } from 'next/router';

	// 		function Component() {
	// 			const searchParams = useSearchParams();
	// 			const router = useRouter();

	// 			const x = searchParams.get('a');

	// 			const z = { ...searchParams.entries(), b: 1}
	// 		}
	// 	`;

	// 	const fileInfo: FileInfo = {
	// 		path: 'index.js',
	// 		source: INPUT,
	// 	};

	// 	const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

	// 	assert.deepEqual(
	// 		actualOutput?.replace(/\W/gm, ''),
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should replace INPUT with OUTPUT (2)', async function (this: Context) {
	// 	const INPUT = `
	// 		import { useRouter } from 'next/router';

	// 		const a = 1;

	// 		function Component() {
	// 			const router = useRouter();

	// 			const nextA = useMemo(
	// 				() => (router.query.a ? null : router.query.b),
	// 				[router.query.a, router.query.b, c],
	// 			) ?? a;
	// 		}
	// 	`;

	// 	const OUTPUT = `
	// 		import { useSearchParams } from 'next/navigation';
	// 		import { useRouter } from 'next/router';

	// 		const a = 1;

	// 		function Component() {
	// 			const searchParams = useSearchParams()
	// 			const router = useRouter();

	// 			const nextA = useMemo(
	// 				() => (searchParams.get('a') ? null : searchParams.get('b')),
	// 				[searchParams, c],
	// 			) ?? a;
	// 		}
	// 	`;

	// 	const fileInfo: FileInfo = {
	// 		path: 'index.js',
	// 		source: INPUT,
	// 	};

	// 	const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

	// 	assert.deepEqual(
	// 		actualOutput?.replace(/\W/gm, ''),
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should replace "query" with "searchParams"', async function (this: Context) {
	// 	const { jscodeshift } = this.buildApi('tsx');

	// 	const root = jscodeshift(`
	// 		import { useRouter } from 'next/router';

	// 		function Component() {
	// 			const { a, b, c } = query;
	// 		}
	// 	`);

	// 	replaceQueryWithSearchParams(jscodeshift, root);

	// 	assert.deepEqual(
	// 		root?.toSource().replace(/\W/gm, '') ?? '',
	// 		`
	// 		import { useRouter } from 'next/router';

	// 		function Component() {
	// 			const { a, b, c } = searchParams;
	// 		}
	// 		`.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should delete query from destructured useRouter call', async function (this: Context) {
	// 	const { jscodeshift } = this.buildApi('tsx');

	// 	const root = jscodeshift(`
	// 		import { useRouter } from 'next/router';

	// 		function Component() {
	// 			const { query } = useRouter();
	// 		}
	// 	`);

	// 	removeQueryFromDestructuredUseRouterCall(jscodeshift, root);

	// 	const OUTPUT = `
	// 		import { useRouter } from 'next/router';

	// 		function Component() {
	// 			const { } = useRouter();
	// 		}
	// 	`;

	// 	assert.deepEqual(
	// 		root?.toSource().replace(/\W/gm, '') ?? '',
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should delete empty useRouter destructuring', async function (this: Context) {
	// 	const { jscodeshift } = this.buildApi('tsx');

	// 	const root = jscodeshift(`
	// 		import { useRouter } from 'next/router';

	// 		function Component() {
	// 			const { } = useRouter();
	// 		}
	// 	`);

	// 	removeEmptyDestructuring(jscodeshift, root);

	// 	const OUTPUT = `
	// 		import { useRouter } from 'next/router';

	// 		function Component() {

	// 		}
	// 	`;

	// 	assert.deepEqual(
	// 		root?.toSource().replace(/\W/gm, '') ?? '',
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should remove unused useRouter import specifiers', async function (this: Context) {
	// 	const { jscodeshift } = this.buildApi('tsx');

	// 	const root = jscodeshift(`
	// 		import { useRouter } from 'next/router';

	// 		function Component() {

	// 		}
	// 	`);

	// 	removeUnusedImportSpecifier(jscodeshift, root);

	// 	const OUTPUT = `
	// 		import 'next/router';

	// 		function Component() {

	// 		}
	// 	`;

	// 	assert.deepEqual(
	// 		root?.toSource().replace(/\W/gm, '') ?? '',
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should remove unused useRouter import declarations', async function (this: Context) {
	// 	const { jscodeshift } = this.buildApi('tsx');

	// 	const root = jscodeshift(`
	// 		import 'next/router';

	// 		function Component() {

	// 		}
	// 	`);

	// 	removeUnusedImportDeclaration(jscodeshift, root);

	// 	const OUTPUT = `
	// 		function Component() {

	// 		}
	// 	`;

	// 	assert.deepEqual(
	// 		root?.toSource().replace(/\W/gm, '') ?? '',
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should not remove CSS imports', async function (this: Context) {
	// 	const { jscodeshift } = this.buildApi('tsx');

	// 	const root = jscodeshift(`
	// 		import './index.css';
	// 	`);

	// 	removeUnusedImportDeclaration(jscodeshift, root);

	// 	const OUTPUT = `
	// 		import './index.css';
	// 	`;

	// 	assert.deepEqual(
	// 		root?.toSource().replace(/\W/gm, '') ?? '',
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should replace INPUT with OUTPUT (3)', async function (this: Context) {
	// 	const INPUT = `
	// 		import { useRouter } from 'next/router';

	// 		function Component() {
	// 			const { query } = useRouter();
	// 			const { a, b, c } = query;
	// 		}
	// 	`;

	// 	const OUTPUT = `
	// 		import { useSearchParams } from 'next/navigation';

	// 		function Component() {
	// 			const searchParams = useSearchParams();
	// 			const a = searchParams.get('a');
	// 			const b = searchParams.get('b');
	// 			const c = searchParams.get('c');
	// 		}
	// 	`;

	// 	const fileInfo: FileInfo = {
	// 		path: 'index.js',
	// 		source: INPUT,
	// 	};

	// 	const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

	// 	assert.deepEqual(
	// 		actualOutput?.replace(/\W/gm, ''),
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should noop for pathname = a.b', async function (this: Context) {
	// 	const INPUT = 'const pathname = a.b;';

	// 	const fileInfo: FileInfo = {
	// 		path: 'index.js',
	// 		source: INPUT,
	// 	};

	// 	const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

	// 	assert.deepEqual(actualOutput, INPUT);
	// });

	// it('should replace useRouter().pathname with usePathname()', async function (this: Context) {
	// 	const INPUT = 'const pathname = useRouter().pathname;';
	// 	const OUTPUT =
	// 		'import { usePathname} from "next/navigation"; const pathname = usePathname();';

	// 	const fileInfo: FileInfo = {
	// 		path: 'index.js',
	// 		source: INPUT,
	// 	};

	// 	const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

	// 	assert.deepEqual(
	// 		actualOutput?.replace(/\W/gm, ''),
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should replace router.pathname with usePathname()', async function (this: Context) {
	// 	const INPUT = 'const pathname = router.pathname;';
	// 	const OUTPUT =
	// 		'import {usePathname} from "next/navigation"; const pathname = usePathname();';

	// 	const fileInfo: FileInfo = {
	// 		path: 'index.js',
	// 		source: INPUT,
	// 	};

	// 	const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

	// 	assert.deepEqual(
	// 		actualOutput?.replace(/\W/gm, ''),
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should replace { pathname } destructed from useRouter() with usePathname()', async function (this: Context) {
	// 	const INPUT = 'const { pathname } = useRouter();';
	// 	const OUTPUT =
	// 		'import {usePathname} from "next/navigation"; const {} = useRouter(); const pathname = usePathname();';

	// 	const fileInfo: FileInfo = {
	// 		path: 'index.js',
	// 		source: INPUT,
	// 	};

	// 	const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

	// 	assert.deepEqual(
	// 		actualOutput?.replace(/\W/gm, ''),
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should replace { pathname } destructed from router with usePathname()', async function (this: Context) {
	// 	const INPUT = 'const { pathname } = router';
	// 	const OUTPUT =
	// 		'import {usePathname} from "next/navigation"; const {} = router; const pathname = usePathname();';

	// 	const fileInfo: FileInfo = {
	// 		path: 'index.js',
	// 		source: INPUT,
	// 	};

	// 	const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

	// 	assert.deepEqual(
	// 		actualOutput?.replace(/\W/gm, ''),
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should replace { pathname: p } destructed from router with const p = usePathname()', async function (this: Context) {
	// 	const INPUT = 'const { pathname: p } = router';
	// 	const OUTPUT =
	// 		'import {usePathname} from "next/navigation"; const {} = router; const p = usePathname();';

	// 	const fileInfo: FileInfo = {
	// 		path: 'index.js',
	// 		source: INPUT,
	// 	};

	// 	const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

	// 	assert.deepEqual(
	// 		actualOutput?.replace(/\W/gm, ''),
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should replace router.isReady with true', async function (this: Context) {
	// 	const INPUT = 'router.isReady';
	// 	const OUTPUT = 'true';

	// 	const fileInfo: FileInfo = {
	// 		path: 'index.js',
	// 		source: INPUT,
	// 	};

	// 	const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

	// 	assert.deepEqual(
	// 		actualOutput?.replace(/\W/gm, ''),
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should replace useRouter().isReady with true', async function (this: Context) {
	// 	const INPUT = 'useRouter().isReady';
	// 	const OUTPUT = 'true';

	// 	const fileInfo: FileInfo = {
	// 		path: 'index.js',
	// 		source: INPUT,
	// 	};

	// 	const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

	// 	assert.deepEqual(
	// 		actualOutput?.replace(/\W/gm, ''),
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should remove { isReady } and replace usages with true', async function (this: Context) {
	// 	const INPUT =
	// 		'function X() { const { isReady } = useRouter(); const x = isReady; }';
	// 	const OUTPUT = 'function X() { const x = true; }';

	// 	const fileInfo: FileInfo = {
	// 		path: 'index.js',
	// 		source: INPUT,
	// 	};

	// 	const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

	// 	assert.deepEqual(
	// 		actualOutput?.replace(/\W/gm, ''),
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should noop for already-existing import', async function (this: Context) {
	// 	const INPUT = `import { usePathname } from 'next/navigation'; const pathname = usePathname();`;

	// 	const fileInfo: FileInfo = {
	// 		path: 'index.js',
	// 		source: INPUT,
	// 	};

	// 	const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

	// 	assert.deepEqual(
	// 		actualOutput?.replace(/\W/gm, ''),
	// 		INPUT.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should add the usePathname import if it is used', async function (this: Context) {
	// 	const INPUT = 'const pathname = usePathname();';
	// 	const OUTPUT = `import { usePathname } from 'next/navigation'; const pathname = usePathname();`;

	// 	const fileInfo: FileInfo = {
	// 		path: 'index.js',
	// 		source: INPUT,
	// 	};

	// 	const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

	// 	assert.deepEqual(
	// 		actualOutput?.replace(/\W/gm, ''),
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	// it('should replace query.a if query comes from useRouter return value destructurizing', async function (this: Context) {
	// 	const INPUT = `
	// 		import { useRouter } from 'next/router';

	// 		export function Component() {
	// 			const { query } = useRouter();

	// 			if (query.a && query.b) {

	// 			}
	// 		}
	// 	`;
	// 	const OUTPUT = `
	// 		import { useSearchParams } from "next/navigation";

	// 		export function Component() {
	// 			const searchParams = useSearchParams();

	// 			if (searchParams.get('a') && searchParams.get('b')) {

	// 			}
	// 		}
	// 	`;

	// 	const fileInfo: FileInfo = {
	// 		path: 'index.js',
	// 		source: INPUT,
	// 	};

	// 	const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

	// 	assert.deepEqual(
	// 		actualOutput?.replace(/\W/gm, ''),
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });
});
