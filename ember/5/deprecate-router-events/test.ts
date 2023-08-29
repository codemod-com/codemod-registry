import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from './index.js';
import { buildApi } from '../../../utilities.js';

describe('ember 5 deprecate-router-events', function () {
	it('basic', function () {
		const INPUT = `
		import Router from '@ember/routing/router';
        import { inject as service } from '@ember/service';

        export default Router.extend({
        currentUser: service('current-user'),

        willTransition(transition) {
            this._super(...arguments);
            if (!this.currentUser.isLoggedIn) {
            transition.abort();
            this.transitionTo('login');
            }
        },

        didTransition(privateInfos) {
            this._super(...arguments);
            ga.send('pageView', {
            pageName: privateInfos.name
            });
        }
        });
		`;

		const OUTPUT = `
		import Router from '@ember/routing/router';
        import { inject as service } from '@ember/service';

        export default Router.extend({
        currentUser: service('current-user'),

        init() {
            this._super(...arguments);

            this.on("routeWillChange", transition => {
            if (!this.currentUser.isLoggedIn) {
                transition.abort();
                this.transitionTo('login');
            }
            });

            this.on("routeDidChange", transition => {
            ga.send('pageView', {
                pageName: privateInfos.name
            });
            });
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
