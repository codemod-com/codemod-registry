import transform from './index.backup';
import assert from 'node:assert/strict';
import { Context } from 'mocha';

// the best case (with no substitutions)
const INPUT = `import { useRouter } from 'next/router';

function Component() {
    const { query } = useRouter();
    const { a, b, c } = query;
}`;

const OUTPUT = `
import { useRouter } from 'next/router';
import { useSearchParams } from 'next/navigation';

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
		const actualOutput = transform('const x = y;');

		assert.deepEqual(actualOutput, undefined);
	});

	it('should replace INPUT with OUTPUT', async function (this: Context) {
		const actualOutput = transform(INPUT);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
