import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from './index.js';
import { buildApi } from '../../../utilities.js';

describe('ember 5 jquery-apis', function () {
	it('Events', function () {
		const INPUT = `
		import Component from '@ember/component';

        export default Component.extend({
        waitForAnimation() {
            this.$().on('transitionend', () => this.doSomething());
        }
        });
        `;

		const OUTPUT = `
        import Component from '@ember/component';

        export default Component.extend({
        waitForAnimation() {
            this.element.addEventListener('transitionend', () => this.doSomething());
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

	it('Query Selector', function () {
		const INPUT = `
		import Component from '@ember/component';

        export default Component.extend({
        waitForAnimation() {
            this.$('.animated').on('transitionend', () => this.doSomething());
        }
        });
        `;

		const OUTPUT = `
        import Component from '@ember/component';

        export default Component.extend({
        waitForAnimation() {
            this.element.querySelectorAll('.animated').forEach(el => el.addEventListener('transitionend', () => this.doSomething()));
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
