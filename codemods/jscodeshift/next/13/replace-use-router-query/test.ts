import transform, {
	addSearchParamsVariableDeclarator,
	addUseSearchParamsImport,
	removeEmptyDestructuring,
	removeQueryFromDestructuredUseRouterCall,
	removeUnusedUseRouterImportDeclaration,
	removeUnusedUseRouterImportSpecifier,
	replaceQueryWithSearchParams,
	replaceRouterQueryWithSearchParams,
	replaceSearchParamsXWithSearchParamsGetX,
	replaceTripleDotRouterQueryWithSearchParams,
	replaceUseRouterQueryWithUseSearchParams,
} from '.';
import assert from 'node:assert/strict';
import { Context } from 'mocha';
import { FileInfo } from 'jscodeshift';

describe('next 13 replace-use-router-query', function () {
	it('should add useSearchParams import because of "router.query"', async function (this: Context) {
		const { jscodeshift } = this.buildApi('tsx');

		const root = jscodeshift(`
			import { useRouter } from 'next/router';

			function Component() {
				const router = useRouter();

				const x = router.query.a;
			}
		`);

		addUseSearchParamsImport(jscodeshift, root);

		assert.deepEqual(
			root?.toSource().replace(/\W/gm, '') ?? '',
			`
			import { useSearchParams } from 'next/navigation';
			import { useRouter } from 'next/router';

			function Component() {
				const router = useRouter();

				const x = router.query.a;
			}
			`.replace(/\W/gm, ''),
		);
	});

	it('should add useSearchParams import because of "useRouter().query"', async function (this: Context) {
		const { jscodeshift } = this.buildApi('tsx');

		const root = jscodeshift(`
			import { useRouter } from 'next/router';

			function Component() {
				const a = useRouter().query.a;
			}
		`);

		addUseSearchParamsImport(jscodeshift, root);

		assert.deepEqual(
			root?.toSource().replace(/\W/gm, '') ?? '',
			`
			import { useSearchParams } from 'next/navigation';
			import { useRouter } from 'next/router';

			function Component() {
				const a = useRouter().query.a;
			}
			`.replace(/\W/gm, ''),
		);
	});

	it('should add useSearchParams import because of "const { query } = useRouter()"', async function (this: Context) {
		const { jscodeshift } = this.buildApi('tsx');

		const root = jscodeshift(`
			import { useRouter } from 'next/router';

			function Component() {
				const { query } = useRouter();
			}
		`);

		addUseSearchParamsImport(jscodeshift, root);

		assert.deepEqual(
			root?.toSource().replace(/\W/gm, '') ?? '',
			`
			import { useSearchParams } from 'next/navigation';
			import { useRouter } from 'next/router';

			function Component() {
				const { query } = useRouter();
			}
			`.replace(/\W/gm, ''),
		);
	});

	it('should add searchParams variable declarator because of "useRouter()"', async function (this: Context) {
		const { jscodeshift } = this.buildApi('tsx');

		const root = jscodeshift(`
			import { useRouter } from 'next/router';

			function Component() {
				const { query } = useRouter();
			}
		`);

		addSearchParamsVariableDeclarator(jscodeshift, root);

		assert.deepEqual(
			root?.toSource().replace(/\W/gm, '') ?? '',
			`
			import { useRouter } from 'next/router';

			function Component() {
				const searchParams = useSearchParams();
				const { query } = useRouter();
			}
			`.replace(/\W/gm, ''),
		);
	});

	it('should replace "...?.query" with "...searchParams.entries()."', async function (this: Context) {
		const { jscodeshift } = this.buildApi('tsx');

		const root = jscodeshift(`
			import { useRouter } from 'next/router';

			function Component() {
				const r = useRouter();

				const shallowCopiedQuery = { ...r.query }
			}
		`);

		replaceTripleDotRouterQueryWithSearchParams(jscodeshift, root);

		assert.deepEqual(
			root?.toSource().replace(/\W/gm, '') ?? '',
			`
			import { useRouter } from 'next/router';

			function Component() {
				const r = useRouter();

				const shallowCopiedQuery = { ...searchParams.entries() }
			}
			`.replace(/\W/gm, ''),
		);
	});

	it('should replace "?.query" with "searchParams"', async function (this: Context) {
		const { jscodeshift } = this.buildApi('tsx');

		const root = jscodeshift(`
			import { useRouter } from 'next/router';

			function Component() {
				const r = useRouter();

				const a = r.query.a;
			}
		`);

		replaceRouterQueryWithSearchParams(jscodeshift, root);

		assert.deepEqual(
			root?.toSource().replace(/\W/gm, '') ?? '',
			`
			import { useRouter } from 'next/router';

			function Component() {
				const r = useRouter();

				const a = searchParams.a;
			}
			`.replace(/\W/gm, ''),
		);
	});

	it('should replace "useRouter().query" with "useSearchParams()"', async function (this: Context) {
		const { jscodeshift } = this.buildApi('tsx');

		const root = jscodeshift(`
			import { useRouter } from 'next/router';

			function Component() {
				const a = useRouter().query.a;
			}
		`);

		replaceUseRouterQueryWithUseSearchParams(jscodeshift, root);

		assert.deepEqual(
			root?.toSource().replace(/\W/gm, '') ?? '',
			`
			import { useRouter } from 'next/router';

			function Component() {
				const a = useSearchParams().a;
			}
			`.replace(/\W/gm, ''),
		);
	});

	it('should replace "searchParams.a" with "searchParams.get("a")"', async function (this: Context) {
		const { jscodeshift } = this.buildApi('tsx');

		const root = jscodeshift(`
			import { useSearchParams } from 'next/navigation';

			function Component() {
				const searchParams = useSearchParams();

				const a = searchParams.a;
			}
		`);

		replaceSearchParamsXWithSearchParamsGetX(jscodeshift, root);

		assert.deepEqual(
			root?.toSource().replace(/\W/gm, '') ?? '',
			`
			import { useSearchParams } from 'next/navigation';

			function Component() {
				const searchParams = useSearchParams();

				const a = searchParams.get('a');
			}
			`.replace(/\W/gm, ''),
		);
	});

	it('should replace INPUT with OUTPUT', async function (this: Context) {
		const INPUT = `
			import { useRouter } from 'next/router';

			function Component() {
				const router = useRouter();
				
				const x = router.query.a;

				const z = { ...router.query, b: 1 }
			}
		`;

		const OUTPUT = `
			import { useSearchParams } from 'next/navigation';
			import { useRouter } from 'next/router';

			function Component() {
				const searchParams = useSearchParams();
				const router = useRouter();
				
				const x = searchParams.get('a');

				const z = { ...searchParams.entries(), b: 1}
			}
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('js'), {});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should replace INPUT with OUTPUT (2)', async function (this: Context) {
		const INPUT = `
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

		const OUTPUT = `
			import { useSearchParams } from 'next/navigation';
			import { useRouter } from 'next/router';

			const a = 1;

			function Component() {
				const searchParams = useSearchParams()
				const router = useRouter();

				const nextA = useMemo(
					() => (searchParams.get('a') ? null : searchParams.get('b')),
					[searchParams, c],
				) ?? a;
			}
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should replace "query" with "searchParams"', async function (this: Context) {
		const { jscodeshift } = this.buildApi('tsx');

		const root = jscodeshift(`
			import { useRouter } from 'next/router';

			function Component() {
				const { a, b, c } = query;
			}
		`);

		replaceQueryWithSearchParams(jscodeshift, root);

		assert.deepEqual(
			root?.toSource().replace(/\W/gm, '') ?? '',
			`
			import { useRouter } from 'next/router';

			function Component() {
				const { a, b, c } = searchParams;
			}
			`.replace(/\W/gm, ''),
		);
	});

	it('should delete query from destructured useRouter call', async function (this: Context) {
		const { jscodeshift } = this.buildApi('tsx');

		const root = jscodeshift(`
			import { useRouter } from 'next/router';

			function Component() {
				const { query } = useRouter();
			}
		`);

		removeQueryFromDestructuredUseRouterCall(jscodeshift, root);

		const OUTPUT = `
			import { useRouter } from 'next/router';

			function Component() {
				const { } = useRouter();
			}
		`;

		assert.deepEqual(
			root?.toSource().replace(/\W/gm, '') ?? '',
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should delete empty useRouter destructuring', async function (this: Context) {
		const { jscodeshift } = this.buildApi('tsx');

		const root = jscodeshift(`
			import { useRouter } from 'next/router';

			function Component() {
				const { } = useRouter();
			}
		`);

		removeEmptyDestructuring(jscodeshift, root);

		const OUTPUT = `
			import { useRouter } from 'next/router';

			function Component() {
				
			}
		`;

		assert.deepEqual(
			root?.toSource().replace(/\W/gm, '') ?? '',
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should remove unused useRouter import specifiers', async function (this: Context) {
		const { jscodeshift } = this.buildApi('tsx');

		const root = jscodeshift(`
			import { useRouter } from 'next/router';

			function Component() {
				
			}
		`);

		removeUnusedUseRouterImportSpecifier({
			importSpecifierImportedName: 'useRouter',
		})(jscodeshift, root);

		const OUTPUT = `
			import 'next/router';

			function Component() {
					
			}
		`;

		assert.deepEqual(
			root?.toSource().replace(/\W/gm, '') ?? '',
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should remove unused useRouter import declarations', async function (this: Context) {
		const { jscodeshift } = this.buildApi('tsx');

		const root = jscodeshift(`
			import 'next/router';

			function Component() {
				
			}
		`);

		removeUnusedUseRouterImportDeclaration({
			importDeclarationSourceValue: 'next/router',
		})(jscodeshift, root);

		const OUTPUT = `
			function Component() {
					
			}
		`;

		assert.deepEqual(
			root?.toSource().replace(/\W/gm, '') ?? '',
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should replace INPUT with OUTPUT (3)', async function (this: Context) {
		const INPUT = `
			import { useRouter } from 'next/router';

			function Component() {
				const { query } = useRouter();
				const { a, b, c } = query;
			}
		`;

		const OUTPUT = `
			import { useSearchParams } from 'next/navigation';

			function Component() {
				const searchParams = useSearchParams();
				const a = searchParams.get('a');
				const b = searchParams.get('b');
				const c = searchParams.get('c');
			}
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
