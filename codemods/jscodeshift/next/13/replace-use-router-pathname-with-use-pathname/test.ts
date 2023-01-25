import type { FileInfo } from 'jscodeshift';
import transform from '.';
import assert from 'node:assert/strict';
import { Context } from 'mocha';

describe.only('next 13 replace-use-router-pathname-with-use-pathname', function () {
	it('should noop for pathname = a.b', async function (this: Context) {
		const INPUT = 'const pathname = a.b;';

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('js'), {});

		assert.deepEqual(actualOutput, null);
	});

	it('should replace useRouter().pathname with usePathname()', async function (this: Context) {
		const INPUT = 'const pathname = useRouter().pathname;';
		const OUTPUT = 'const pathname = usePathname();';

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

	it('should replace router.pathname with usePathname()', async function (this: Context) {
		const INPUT = 'const pathname = router.pathname;';
		const OUTPUT = 'const pathname = usePathname();';

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
