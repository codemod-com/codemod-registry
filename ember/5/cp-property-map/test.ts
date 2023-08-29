import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from './index.js';
import { buildApi } from '../../../utilities.js';

describe('ember 5 cp-property-map', function () {
	it('basic', function () {
		const INPUT = `
		const Person = EmberObject.extend({
            friendNames: map('friends', function(friend) {
              return friend[this.get('nameKey')];
            }).property('nameKey')
          });
		`;

		const OUTPUT = `
		const Person = EmberObject.extend({
            friendNames: map('friends', ['nameKey'], function(friend) {
              return friend[this.get('nameKey')];
            })
          });
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
