import type { FileInfo } from 'jscodeshift';
import transform from '.';
import assert from 'node:assert/strict';
import { Context } from 'mocha';

describe.only('next 13 add-use-pathname-import', function () {
	it('should noop for pathname = a.b', async function (this: Context) {
		const INPUT = 'const pathname = a.b;';

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('js'), {});

		assert.deepEqual(actualOutput, undefined);
	});

	it('should noop for already-existing import', async function (this: Context) {
		const INPUT = `import { usePathname } from 'next/navigation'; const pathname = usePathname();`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('js'), {});

		assert.deepEqual(actualOutput, undefined);
	});

	it('should add the usePathname import if it is used', async function (this: Context) {
		const INPUT = 'const pathname = usePathname();';
		const OUTPUT = `import { usePathname } from 'next/navigation'; const pathname = usePathname();`;

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
