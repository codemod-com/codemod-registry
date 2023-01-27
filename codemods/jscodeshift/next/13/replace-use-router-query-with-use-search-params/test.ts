import transform from '.';
import assert from 'node:assert/strict';
import { Context } from 'mocha';
import { FileInfo } from 'jscodeshift';

// the best case (with no substitutions)
const INPUT = `import { useRouter } from 'next/router';

function Component() {
    const { query } = useRouter();
    const { a, b, c } = query;
}`;

const OUTPUT = `
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';

function Component() {
	const { } = useRouter();
    const query = useSearchParams();
    const a = query.get('a');
	const b = query.get('b');
	const c = query.get('c');
}
`;

describe('next 13 replace-use-router-query-with-use-search-params', function () {
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

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
