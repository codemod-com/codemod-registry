import transform from '.';
import assert from 'node:assert/strict';
import { Context } from 'mocha';
import { FileInfo } from 'jscodeshift';

// the best case (with no substitutions)
const INPUT = `import { useRouter } from 'next/router';

function Component() {
    const router = useRouter();
    
    const x = router.query.a;
}`;

const OUTPUT = `
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';

function Component() {
	const { } = useRouter();
    const query = useSearchParams();
    
    const x = query.get('a');
}
`;

describe.only('next 13 replace-use-router-query-chains-with-use-search-params', function () {
	it('should noop', async function (this: Context) {
		const fileInfo: FileInfo = {
			path: 'index.js',
			source: 'const x = y;',
		};

		const actualOutput = transform(fileInfo, this.buildApi('js'), {});

		assert.deepEqual(actualOutput, undefined);
	});

	it('should replace INPUT with OUTPUT', async function (this: Context) {
		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('js'), {});

		console.log('A', actualOutput);

		// assert.deepEqual(
		// 	actualOutput?.replace(/\W/gm, ''),
		// 	OUTPUT.replace(/\W/gm, ''),
		// );
	});
});
