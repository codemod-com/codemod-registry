import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from '../src/index.js';
import { buildApi } from '@codemod-registry/utilities';

describe('netlify 0.8.5 createEnvironmentVariable', function () {
	it('changes createEnvironmentVariable to pass an object instead of the separate arguments', function () {
		const INPUT = `
            createEnvironmentVariable(accountId, siteId, key, values);
        `;

		const OUTPUT = `
            createEnvironmentVariable({
                accountId: accountId,
                siteId: siteId,
                key: key,
                values: values
            })
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
