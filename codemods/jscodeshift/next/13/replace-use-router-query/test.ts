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
	// it('should noop', async function (this: Context) {
	// 	const fileInfo: FileInfo = {
	// 		path: 'index.js',
	// 		source: 'const x = y;',
	// 	};

	// 	const actualOutput = transform(fileInfo, this.buildApi('js'), {});

	// 	assert.deepEqual(actualOutput, undefined);
	// });

	it.only('should add useSearchParams import', async function (this: Context) {
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

	it('should replace INPUT with OUTPUT', async function (this: Context) {
		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('js'), {});

		console.log('A', actualOutput);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
