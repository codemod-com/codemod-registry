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

describe('i18n remove unused translations', function () {
	it("should support t('translationKey')", async function (this: Context) {
		const A_CONTENT = `
		import { useLocale } from "@calcom/lib/hooks/useLocale";
		
		export default function A() {
			const { t } = useLocale();
			
			return <p>{t('key1')}</p>
		}
	`;

		const LOCALE_CONTENT = `
	{
		"key1": "key1",
		"key2": "key2"
	}	
	`;

		const [upsertDataCommand] = await transform({
			'/opt/project/components/A.tsx': A_CONTENT,
			'/opt/project/public/static/locales/en/common.json': LOCALE_CONTENT,
		});

		const expectedResult = `
		{
			"key1": "key1"
		}	
		`;
		deepStrictEqual(upsertDataCommand?.kind, 'upsertFile');

		deepStrictEqual(
			upsertDataCommand.path,
			'/opt/project/public/static/locales/en/common.json',
		);

		deepStrictEqual(
			upsertDataCommand.data.replace(/\W/gm, ''),
			expectedResult.replace(/\W/gm, ''),
		);
	});

	it("should support props.language('translationKey')", async function (this: Context) {
		const A_CONTENT = `
		import { useLocale } from "@calcom/lib/hooks/useLocale";
		
		export default function A(props) {
			return <p>{props.language('key1')}</p>
		}
	`;

		const LOCALE_CONTENT = `
	{
		"key1": "key1",
		"key2": "key2"
	}	
	`;

		const [upsertDataCommand] = await transform({
			'/opt/project/components/A.tsx': A_CONTENT,
			'/opt/project/public/static/locales/en/common.json': LOCALE_CONTENT,
		});

		const expectedResult = `
		{
			"key1": "key1"
		}	
		`;
		deepStrictEqual(upsertDataCommand?.kind, 'upsertFile');

		deepStrictEqual(
			upsertDataCommand.path,
			'/opt/project/public/static/locales/en/common.json',
		);

		deepStrictEqual(
			upsertDataCommand.data.replace(/\W/gm, ''),
			expectedResult.replace(/\W/gm, ''),
		);
	});

	it("should support <Trans i18nKey='translationKey'", async function (this: Context) {
		const A_CONTENT = `
		import { Trans } from "next-i18next";
		
		export default function A() {
			return <Trans i18nKey="key1"></Trans>
		}
	`;

		const LOCALE_CONTENT = `
	{
		"key1": "key1",
		"key2": "key2"
	}	
	`;

		const [upsertDataCommand] = await transform({
			'/opt/project/components/A.tsx': A_CONTENT,
			'/opt/project/public/static/locales/en/common.json': LOCALE_CONTENT,
		});

		const expectedResult = `
		{
			"key1": "key1"
		}	
		`;
		deepStrictEqual(upsertDataCommand?.kind, 'upsertFile');

		deepStrictEqual(
			upsertDataCommand.path,
			'/opt/project/public/static/locales/en/common.json',
		);

		deepStrictEqual(
			upsertDataCommand.data.replace(/\W/gm, ''),
			expectedResult.replace(/\W/gm, ''),
		);
	});
});
