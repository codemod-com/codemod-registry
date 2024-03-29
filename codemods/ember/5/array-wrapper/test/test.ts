import { FileInfo } from 'jscodeshift';
import { describe, it } from 'vitest';
import assert from 'node:assert';
import transform from '../src/index.js';
import { buildApi } from '@codemod-registry/utilities';

describe('ember 5 array-wrapper', function () {
	it('basic', function () {
		const INPUT = `
		import { A } from '@ember/array';
        let arr = new A();
		`;

		const OUTPUT = `
		import { A as emberA } from '@ember/array';
        let arr = A();
        `;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('js'));

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
