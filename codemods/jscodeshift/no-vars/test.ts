import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from '.';

describe('no-vars', function () {
	it('should keep var as it is', function () {
		const INPUT = `
            var declaredTwice;
            var declaredTwice;
        `;

		const OUTPUT = `
            var declaredTwice;
            var declaredTwice;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	
});
