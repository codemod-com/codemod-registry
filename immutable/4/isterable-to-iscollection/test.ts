import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from './index.js';
import { buildApi } from '../../../utilities.js';

describe('immutable-4 isiterable-to-iscollection', function () {
	it('should change the isIterable identifier into the isCollection identifier', function () {
		const INPUT = `
            Immutable.Iterable.isIterable();
        `;

		const OUTPUT = `
            Immutable.Iterable.isCollection()
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
