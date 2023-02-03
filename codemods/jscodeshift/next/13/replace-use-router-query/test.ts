import transform, {
	transformAddSearchParamsVariableDeclarator,
	transformAddUseSearchParamsImport,
	transformReplaceRouterQueryWithSearchParams,
	transformReplaceSearchParamsXWithSearchParamsGetX,
	transformTripleDotReplaceRouterQueryWithSearchParams,
	transformUseRouterQueryWithUseSearchParams,
} from '.';
import assert from 'node:assert/strict';
import { Context } from 'mocha';
import { FileInfo } from 'jscodeshift';

describe.only('next 13 replace-use-router-query', function () {
	it('should add useSearchParams import because of "router.query"', async function (this: Context) {
		const { jscodeshift } = this.buildApi('tsx');

		const root = jscodeshift(`
			import { useRouter } from 'next/router';

			function Component() {
				const router = useRouter();

				const x = router.query.a;
			}
		`);

		transformAddUseSearchParamsImport(jscodeshift, root);

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

		transformAddUseSearchParamsImport(jscodeshift, root);

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

		transformAddUseSearchParamsImport(jscodeshift, root);

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

		transformAddSearchParamsVariableDeclarator(jscodeshift, root);

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

		transformTripleDotReplaceRouterQueryWithSearchParams(jscodeshift, root);

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

		transformReplaceRouterQueryWithSearchParams(jscodeshift, root);

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

		transformUseRouterQueryWithUseSearchParams(jscodeshift, root);

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

		transformReplaceSearchParamsXWithSearchParamsGetX(jscodeshift, root);

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
});
