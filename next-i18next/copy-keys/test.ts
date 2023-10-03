import { Context } from 'mocha';
import { DirectoryJSON, Volume, createFsFromVolume } from 'memfs';
import {
	FileSystemManager,
	UnifiedFileSystem,
	buildApi,
	executeRepomod,
} from '@intuita-inc/repomod-engine-api';
import { repomod } from './index.js';
import tsmorph from 'ts-morph';
import { deepStrictEqual } from 'node:assert';

const transform = async (json: DirectoryJSON) => {
	const volume = Volume.fromJSON(json);

	const fileSystemManager = new FileSystemManager(
		volume.promises.readdir as any,
		volume.promises.readFile as any,
		volume.promises.stat as any,
	);

	const fileSystem = createFsFromVolume(volume) as any;

	const unifiedFileSystem = new UnifiedFileSystem(
		fileSystem,
		fileSystemManager,
	);

	const api = buildApi<{
		tsmorph: typeof tsmorph;
		unifiedFileSystem: UnifiedFileSystem;
	}>(unifiedFileSystem, () => ({
		tsmorph,
		unifiedFileSystem,
	}));

	return executeRepomod(api, repomod, '/', {}, {});
};

describe.only('next-i18n copy keys', function () {
	it('should copy a key into a new namespace', async function (this: Context) {
		const EN_COMMON_JSON = `
			{
				"copyKey": "copyKeyEnglish",
				"noopKey": "noopKeyEnglish"
			}
		`;

		const DE_COMMON_JSON = `
			{
				"copyKey": "copyKeyGerman",
				"noopKey": "noopKeyGerman"
			}
		`;

		const [upsertEnDataCommand, upsertDeDataCommand] = await transform({
			'/opt/project/public/static/locales/en/common.json': EN_COMMON_JSON,
			'/opt/project/public/static/locales/de/common.json': DE_COMMON_JSON,
		});

		{
			deepStrictEqual(upsertEnDataCommand?.kind, 'upsertFile');

			deepStrictEqual(
				upsertEnDataCommand.path,
				'/opt/project/public/static/locales/en/new.json',
			);

			deepStrictEqual(
				upsertEnDataCommand.data.replace(/\W/gm, ''),
				`{"copyKey": "copyKeyEnglish"}`.replace(/\W/gm, ''),
			);
		}

		{
			deepStrictEqual(upsertDeDataCommand?.kind, 'upsertFile');

			deepStrictEqual(
				upsertDeDataCommand.path,
				'/opt/project/public/static/locales/de/new.json',
			);

			deepStrictEqual(
				upsertDeDataCommand.data.replace(/\W/gm, ''),
				`{"copyKey": "copyKeyGerman"}`.replace(/\W/gm, ''),
			);
		}
	});
});
