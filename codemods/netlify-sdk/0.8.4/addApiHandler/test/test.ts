import { FileInfo } from 'jscodeshift';
import { describe, it } from 'vitest';
import assert from 'node:assert';
import transform from '../src/index.js';
import { buildApi } from '@codemod-registry/utilities';

describe('netlify 0.8.1 addBuildEventContext', function () {
	it('changes addBuildContext to addBuildEventContext', function () {
		const INPUT = `
			integration.addHandler('some-function', async (event, context) => {});
        `;

		const OUTPUT = `
			integration.addApiHandler('some-function', async (event, context) => {});
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
