import { FileInfo } from 'jscodeshift';
import { describe, it } from 'vitest';
import assert from 'node:assert';
import transform from '../src/index.js';
import { buildApi } from '@codemod-registry/utilities';

describe('netlify 0.8.1 disableBuildEventHandlers', function () {
	it('changes disableBuildhook to disableBuildEventHandlers', function () {
		const INPUT = `
			await client.disableBuildhook(siteId);
        `;

		const OUTPUT = `
			await client.disableBuildEventHandlers(siteId);
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
