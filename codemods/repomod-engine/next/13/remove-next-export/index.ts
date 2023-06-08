import { posix } from 'node:path';
import tsmorph from 'ts-morph';
import type { Repomod } from '@intuita-inc/repomod-engine-api';

// eslint-disable-next-line @typescript-eslint/ban-types
type Dependencies = Readonly<{
	tsmorph: typeof tsmorph;
}>;

//

export const repomod: Repomod<Dependencies> = {
	includePatterns: ['**/package.json', '**/*.{md,sh}'],
	excludePatterns: ['**/node_modules/**'],
	handleData: async (api, path, data, options) => {
		const extension = posix.extname(path);

		if (extension === '.json') {
			try {
				const json = JSON.parse(data);
				// follow a happy path, in the worse case it will throw an error
				const entries = Object.entries(json.scripts);

				for (const [key, value] of entries) {
					if (typeof value !== 'string') {
						continue;
					}

					if (value.includes('next export')) {
						delete json.scripts[key];
					}
				}

				const newData = JSON.stringify(json);

				return {
					kind: 'upsertData',
					path,
					data: newData,
				};
			} catch (error) {
				return {
					kind: 'noop',
				};
			}
		}

		if (extension === '.md' || extension === '.sh') {
			const newData = data
				.split('\n')
				.filter((line) => !line.includes('next export'))
				.join('\n');

			if (newData === data) {
				return {
					kind: 'noop',
				};
			}

			return {
				kind: 'upsertData',
				path,
				data: newData,
			};
		}

		return {
			kind: 'noop',
		};
	},
};
