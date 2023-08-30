import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from './index.js';
import { buildApi } from '../../../utilities.js';

describe('ember 5 jquery-event', function () {
	it('basic', function () {
		const INPUT = `
		// your event handler:
        export default Component.extend({
        click(event) {
        let x = event.originalEvent.clientX;
        }
        });
		`;

		const OUTPUT = `
		// your event handler:
        export default Component.extend({
        click(event) {
        let x = event.clientX;
        }
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
