import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from './index.js';
import { buildApi } from '../../../utilities.js';

describe('netlify 0.8.5 createEnvironmentVariable', function () {
	it('changes createEnvironmentVariable to pass an object instead of the separate arguments', function () {
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