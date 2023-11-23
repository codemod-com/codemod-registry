import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from '../src/index.js';
import { buildApi } from '@codemod-registry/utilities';

describe('ember 5 ember-jquery-legacy', function () {
	it('basic', function () {
		const INPUT = `
		export default Component.extend({
            click(event) {
              let nativeEvent = event.originalEvent;
            }
            });
		`;

		const OUTPUT = `
		import { normalizeEvent } from "ember-jquery-legacy";
        export default Component.extend({
        click(event) {
        let nativeEvent = normalizeEvent(event);
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
