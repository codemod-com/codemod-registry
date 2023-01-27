import type { FileInfo } from 'jscodeshift';
import transform from '.';
import assert from 'node:assert/strict';
import { Context } from 'mocha';

// the best case (with no substitutions)
const INPUT = `import { useRouter } from 'next/router'; // find this first (could be aliased, probably is not)

function Component() {
	const { query } = useRouter(); //check the usage of this function

	const { a } = query;
}`;

const OUTPUT = `
import { useSearchParams } from 'next/navigation';

function Component() {
	const query = useSearchParams();

	const a = query.get('a');
}
`;

describe('next 13 replace-use-router-query-with-use-search-params', function () {
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
