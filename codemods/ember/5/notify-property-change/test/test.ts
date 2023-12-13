import { FileInfo } from 'jscodeshift';
import { describe, it } from 'vitest';
import assert from 'node:assert';
import transform from '../src/index.js';
import { buildApi } from '@codemod-registry/utilities';

describe('ember 5 notify-property-change', function () {
	it('basic', function () {
		const INPUT = `
		Ember.propertyWillChange(object, 'someProperty');
		doStuff(object);
		Ember.propertyDidChange(object, 'someProperty');

		object.propertyWillChange('someProperty');
		doStuff(object);
		object.propertyDidChange('someProperty');
		`;

		const OUTPUT = `
		doStuff(object);
		Ember.notifyPropertyChange(object, 'someProperty');
		
		doStuff(object);
		object.notifyPropertyChange('someProperty');
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
