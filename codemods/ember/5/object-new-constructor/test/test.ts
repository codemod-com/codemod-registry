import { FileInfo } from 'jscodeshift';
import { describe, it } from 'vitest';
import assert from 'node:assert';
import transform from '../src/index.js';
import { buildApi } from '@codemod-registry/utilities';

describe('ember 5 object-new-constructor', function () {
	it('basic', function () {
		const INPUT = `
		let obj1 = new EmberObject();
		let obj2 = new EmberObject({ prop: 'value' });

		const Foo = EmberObject.extend();
		let foo = new Foo({ bar: 123 });
		`;

		const OUTPUT = `
		let obj1 = EmberObject.create();
		let obj2 = EmberObject.create({ prop: 'value' });
		
		const Foo = EmberObject.extend();
		let foo = new Foo({ bar: 123 });
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
