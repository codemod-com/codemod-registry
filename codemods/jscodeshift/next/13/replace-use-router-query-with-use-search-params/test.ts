import transform from '.';
import assert from 'node:assert/strict';
import { Context } from 'mocha';

// the best case (with no substitutions)
const INPUT = `import { useRouter } from 'next/router';

function Component() {
	const { query } = useRouter();

	const { a } = query;
}`;

const OUTPUT = `
import { useSearchParams } from 'next/navigation';

function Component() {
	const query = useSearchParams();

	const a = query.get('a');
}
`;

describe.only('next 13 replace-use-router-query-with-use-search-params', function () {
	it('should replace INPUT with OUTPUT', async function (this: Context) {
		const actualOutput = transform(INPUT);

		console.log(INPUT);

		console.log(actualOutput);

		// assert.deepEqual(
		// 	actualOutput?.replace(/\W/gm, ''),
		// 	OUTPUT.replace(/\W/gm, ''),
		// );
	});
});
