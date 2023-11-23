import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from '../src/index.js';
import { buildApi } from '@codemod-registry/utilities';

describe('netlify 0.8.1 addBuildEventContext', function () {
	it('changes addBuildHook to addBuildEventContext', function () {
		const INPUT = `
			integration.addBuildHook("onPreBuild", () => {});
        `;

		const OUTPUT = `
			integration.addBuildEventHandler("onPreBuild", () => {});
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
