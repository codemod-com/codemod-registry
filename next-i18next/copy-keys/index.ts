import { Repomod } from '@intuita-inc/repomod-engine-api';

type Dependencies = {};
type State = {};

export const repomod: Repomod<Dependencies, State> = {
	includePatterns: ['**/locales/**/*.json'],
	excludePatterns: ['**/node_modules/**'],
	initializeState: async (_, previousState) => {
		return previousState ?? {};
	},
	handleFinish: async (_, state) => {
		return { kind: 'noop' };
	},
	handleData: async (api, path, data, options, state) => {
		return {
			kind: 'noop',
		};
	},
};
