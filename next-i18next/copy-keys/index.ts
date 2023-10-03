// import { join, posix } from 'node:path';
import { Repomod } from '@intuita-inc/repomod-engine-api';

type Dependencies = Record<string, never>;
type State = {
	oldWorkspace: string;
	newWorkspace: string;
	keys: ReadonlyArray<string>;
	map: Map<string, string>;
};

export const repomod: Repomod<Dependencies, State> = {
	includePatterns: ['**/locales/**/*.json'],
	excludePatterns: ['**/node_modules/**'],
	initializeState: async (options) => {
		const oldWorkspace = options['oldWorkspace'];
		const newWorkspace = options['newWorkspace'];
		const keys = options['keys'];

		return {
			oldWorkspace:
				typeof oldWorkspace === 'string' ? oldWorkspace : 'common',
			newWorkspace:
				typeof newWorkspace === 'string' ? newWorkspace : 'new',
			keys: typeof keys === 'string' ? keys.split(',') : [],
			map: new Map(),
		};
	},
	handleFile: async (api, path, options, state) => {
		if (state === null) {
			return [];
		}

		const basename = api.getBasename(path);

		if (basename !== `${state.oldWorkspace}.json`) {
			return [];
		}

		try {
			const dirname = api.getDirname(path);
			const newPath = api.joinPaths(
				dirname,
				`${state.newWorkspace}.json`,
			);

			const json = await api.readFile(path);
			const data = JSON.parse(json);

			for (const key of state.keys) {
				const value = data[key];

				if (typeof value !== 'string') {
					continue;
				}

				state?.map.set(`${newPath}:${key}`, value);
			}

			return [
				{
					kind: 'upsertFile',
					path: newPath,
					options,
				},
			];
		} catch (error) {
			console.error('log', error);
			return [];
		}
	},
	handleData: async (_, path, __, ___, state) => {
		if (state === null) {
			return { kind: 'noop' };
		}

		const obj: Record<string, string> = {};

		for (const key of state.keys) {
			const value = state.map.get(`${path}:${key}`);

			if (value === undefined) {
				continue;
			}

			obj[key] = value;
		}

		const data = JSON.stringify(obj);

		return {
			kind: 'upsertData',
			path,
			data,
		};
	},
};
