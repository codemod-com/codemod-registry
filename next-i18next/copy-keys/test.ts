import { Context } from 'mocha';
import { DirectoryJSON, Volume, createFsFromVolume } from 'memfs';
import {
	FileSystemManager,
	UnifiedFileSystem,
	buildApi,
	executeFilemod,
} from '@intuita-inc/filemod';
import { repomod } from './index.js';
import { deepStrictEqual } from 'node:assert';

type Options = Readonly<Record<string, string | number | boolean | undefined>>;

const transform = async (json: DirectoryJSON, options: Options) => {
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

	const api = buildApi<Record<string, never>>(
		unifiedFileSystem,
		() => ({}),
		'/',
	);

	return executeFilemod(api, repomod, '/', options, {});
};

describe('next-i18n copy keys', function () {
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

		const [upsertEnDataCommand, upsertDeDataCommand] = await transform(
			{
				'/opt/project/public/static/locales/en/common.json':
					EN_COMMON_JSON,
				'/opt/project/public/static/locales/de/common.json':
					DE_COMMON_JSON,
			},
			{
				oldNamespace: 'common',
				newNamespace: 'new',
				keys: 'copyKey',
			},
		);

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

	it('should copy a key into an existing namespace', async function (this: Context) {
		const EN_COMMON_JSON = `
			{
				"copyKey": "copyKeyEnglish",
				"noopKey": "noopKeyEnglish"
			}
		`;

		const EN_EXISTING_JSON = `
			{
				"otherKey": "otherKeyEnglish"
			}
		`;

		const DE_COMMON_JSON = `
			{
				"copyKey": "copyKeyGerman",
				"noopKey": "noopKeyGerman"
			}
		`;

		const DE_EXISTING_JSON = `
			{
				"otherKey": "otherKeyGerman"
			}
		`;

		const [upsertEnDataCommand, upsertDeDataCommand] = await transform(
			{
				'/opt/project/public/static/locales/en/common.json':
					EN_COMMON_JSON,
				'/opt/project/public/static/locales/en/existing.json':
					EN_EXISTING_JSON,
				'/opt/project/public/static/locales/de/common.json':
					DE_COMMON_JSON,
				'/opt/project/public/static/locales/de/existing.json':
					DE_EXISTING_JSON,
			},
			{
				oldNamespace: 'common',
				newNamespace: 'existing',
				keys: 'copyKey',
			},
		);

		{
			deepStrictEqual(upsertEnDataCommand?.kind, 'upsertFile');

			deepStrictEqual(
				upsertEnDataCommand.path,
				'/opt/project/public/static/locales/en/existing.json',
			);

			deepStrictEqual(
				upsertEnDataCommand.data.replace(/\W/gm, ''),
				`{"otherKey": "otherKeyEnglish","copyKey": "copyKeyEnglish"}`.replace(
					/\W/gm,
					'',
				),
			);
		}

		{
			deepStrictEqual(upsertDeDataCommand?.kind, 'upsertFile');

			deepStrictEqual(
				upsertDeDataCommand.path,
				'/opt/project/public/static/locales/de/existing.json',
			);

			deepStrictEqual(
				upsertDeDataCommand.data.replace(/\W/gm, ''),
				`{"otherKey": "otherKeyGerman","copyKey": "copyKeyGerman",}`.replace(
					/\W/gm,
					'',
				),
			);
		}
	});
});
