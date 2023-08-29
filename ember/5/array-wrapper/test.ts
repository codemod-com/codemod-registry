import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from './index.js';
import { buildApi } from '../../../utilities.js';

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
