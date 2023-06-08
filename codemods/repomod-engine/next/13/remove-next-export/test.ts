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
		a: 'b',
		export: 'rimraf a && next export --threads=3 -o export && yarn a',
	},
});

const NEXT_CONFIG_JSON = `
module.exports = {
	distDir: 'out',
}`;

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
# Header
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
		'/opt/project/pages/next.config.js': NEXT_CONFIG_JSON,
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

describe('next 13 remove-next-export', function () {
	it('should build correct files', async function (this: Context) {
		const externalFileCommands = await transform();

		deepStrictEqual(externalFileCommands, [
			{
				kind: 'upsertFile',
				path: '/opt/project/package.json',
				data: '{"scripts":{"a":"b"}}',
			},
			{
				kind: 'upsertFile',
				path: '/opt/project/pages/script_c.sh',
				data: '\n',
			},
			{
				kind: 'upsertFile',
				path: '/opt/project/pages/script_b.sh',
				data: '\nnpm run next build\n',
			},
			{
				kind: 'upsertFile',
				path: '/opt/project/pages/script_a.sh',
				data: '\nnode_modules/.bin/next build\n',
			},
			{
				data: 'module.exports = {\n    distDir: \'out\',\n    output: "export"\n};\n',
				kind: 'upsertFile',
				path: '/opt/project/pages/next.config.js',
			},
			{
				kind: 'upsertFile',
				path: '/opt/project/pages/README.md',
				data: '\n# Header\n',
			},
		]);
	});
});
