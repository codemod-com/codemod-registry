import type { FileInfo } from 'jscodeshift';
import transform from '.';
import assert from 'node:assert/strict';
import { Context } from 'mocha';

describe.only('next 13 use-pathname', function () {
	it('should replace useRouter().pathname with usePathname()', async function (this: Context) {
		const INPUT = 'const pathname = useRouter().pathname;';
		const OUTPUT = `import { usePathname } from 'next/navigation';const pathname = usePathname();`;

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
