import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from '../src/index.js';
import { buildApi } from '@codemod-registry/utilities';

describe('netlify 0.8.1 export zod', function () {
	it('exports zod to netlify sdk', function () {
		const INPUT = `
            import { z } from 'zod';
        `;

		const OUTPUT = `
            import { z } from '@netlify/sdk'
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
