import {
	FileSystemManager,
	UnifiedFileSystem,
	buildApi,
	executeRepomod,
} from '@intuita-inc/repomod-engine-api';
import { Volume, createFsFromVolume } from 'memfs';
import tsmorph from 'ts-morph';
import { repomod } from './index.js';
import { Context } from 'mocha';
import { deepStrictEqual, ok } from 'node:assert';

const PACKAGE_JSON = JSON.stringify({
	scripts: {
		export: 'rimraf a && next export --threads=3 -o export && yarn a',
	},
});

const SCRIPT_SH_A = `
node_modules/.bin/next build
node_modules/.bin/next export
`;

const SCRIPT_SH_B = `
npm run next build
npm run next export
`;

const SCRIPT_SH_C = `
npx next export
`;

const README_MD = `
next export -o public
`;

const transform = async () => {
	const volume = Volume.fromJSON({
		'/opt/project/package.json': PACKAGE_JSON,
		'/opt/project/pages/script_a.sh': SCRIPT_SH_A,
		'/opt/project/pages/script_b.sh': SCRIPT_SH_B,
		'/opt/project/pages/script_c.sh': SCRIPT_SH_C,
		'/opt/project/pages/README.md': README_MD,
		'/opt/project/pages/README.notmd': README_MD,
	});

	const fileSystemManager = new FileSystemManager(
		volume.promises.readdir as any,
		volume.promises.readFile as any,
		volume.promises.stat as any,
	);
	const unifiedFileSystem = new UnifiedFileSystem(
		createFsFromVolume(volume) as any,
		fileSystemManager,
	);

	const api = buildApi<{
		tsmorph: typeof tsmorph;
	}>(unifiedFileSystem, () => ({
		tsmorph,
	}));

	return executeRepomod(api, repomod, '/', {});
};

describe.only('next 13 remove-next-export', function () {
	it('should build correct files', async function (this: Context) {
		const externalFileCommands = await transform();

		deepStrictEqual(externalFileCommands.length, 1);

		// ok(
		// 	externalFileCommands.some(
		// 		(command) => command.path === '/opt/project/app/layout.tsx',
		// 	),
		// );
	});
});
