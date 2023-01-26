import type { FileInfo } from 'jscodeshift';
import transform from '.';
import assert from 'node:assert/strict';
import { Context } from 'mocha';

describe('next 13 replace-destructed-pathname-with-use-pathname', function () {
	it('should noop for pathname = a.b', async function (this: Context) {
		const INPUT = 'const pathname = a.b;';

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('js'), {});

		assert.deepEqual(actualOutput, null);
	});

	it.only('should replace { pathname } destructed from useRouter() with usePathname()', async function (this: Context) {
		const INPUT = 'const { pathname } = useRouter();';
		const OUTPUT =
			'const {} = useRouter(); const pathname = usePathname();';

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('js'), {});

		console.log(actualOutput);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should replace { pathname } destructed from router with usePathname()', async function (this: Context) {
		const INPUT = 'const { pathname } = router';
		const OUTPUT = 'const {} = router; const pathname = usePathname();';

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
