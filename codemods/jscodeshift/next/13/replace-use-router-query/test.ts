import transform, { transformAddUseSearchParamsImport } from '.';
import assert from 'node:assert/strict';
import { Context } from 'mocha';
import { FileInfo } from 'jscodeshift';

// the best case (with no substitutions)
const INPUT = `import { useRouter } from 'next/router';

function Component() {
    const router = useRouter();
    
    const x = router.query.a;

	const z = { ...router.query, b: 1 }
}`;

const OUTPUT = `
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';

function Component() {
	const query = useSearchParams();
	const router = useRouter();
    
    const x = query.get('a');

	const z = { ...query.entries(), b: 1}
}
`;

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

		transformAddUseSearchParamsImport(jscodeshift, root);

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

	// it('should replace INPUT with OUTPUT', async function (this: Context) {
	// 	const fileInfo: FileInfo = {
	// 		path: 'index.js',
	// 		source: INPUT,
	// 	};

	// 	const actualOutput = transform(fileInfo, this.buildApi('js'), {});

	// 	console.log('A', actualOutput);

	// 	assert.deepEqual(
	// 		actualOutput?.replace(/\W/gm, ''),
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });
});
