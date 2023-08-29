import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from './index.js';
import { buildApi } from '../../../utilities.js';

describe('ember 5 fpe-observes', function () {
	it('basic', function () {
		const INPUT = `
		import EmberObject from '@ember/object';

        export default EmberObject.extend({
        valueObserver: function() {
            // Executes whenever the "value" property changes
        }.observes('value')
        });
		`;

		const OUTPUT = `
		import EmberObject from '@ember/object';

        export default EmberObject.extend({
        valueObserver: observer('value', function() {
            // Executes whenever the "value" property changes
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
