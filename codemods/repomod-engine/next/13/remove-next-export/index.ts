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
	handleFile: async (api, path, options) => {
		console.log(path);

		return [];
	},
};
