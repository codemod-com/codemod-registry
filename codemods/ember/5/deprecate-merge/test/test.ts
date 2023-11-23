import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from '../src/index.js';
import { buildApi } from '@codemod-registry/utilities';

describe('ember 5 deprecate-merge', function () {
	it('basic', function () {
		const INPUT = `
		import { merge } from '@ember/polyfills';

        var a = { first: 'Yehuda' };
        var b = { last: 'Katz' };
        merge(a, b);
		`;

		const OUTPUT = `
		import { assign } from '@ember/polyfills';

        var a = { first: 'Yehuda' };
        var b = { last: 'Katz' };
        assign(a, b);
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
