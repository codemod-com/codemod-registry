import { Context } from 'mocha';
import { deepStrictEqual } from 'node:assert';
import { DirectoryJSON, Volume, createFsFromVolume } from 'memfs';
import {
	FileSystemManager,
	UnifiedFileSystem,
	buildApi,
	executeRepomod,
} from '@intuita-inc/repomod-engine-api';
import { buildData, repomod } from './index.js';

const transform = async (json: DirectoryJSON) => {
	const volume = Volume.fromJSON(json);

	const fileSystemManager = new FileSystemManager(
		volume.promises.readdir as any,
		volume.promises.readFile as any,
		volume.promises.stat as any,
	);
	const unifiedFileSystem = new UnifiedFileSystem(
		createFsFromVolume(volume) as any,
		fileSystemManager,
	);

	const api = buildApi<Record<string, never>>(unifiedFileSystem, () => ({}));

	return executeRepomod(api, repomod, '/', { testPath: '/opt/tests' }, {});
};

type ExternalFileCommand = Awaited<ReturnType<typeof transform>>[number];

const removeWhitespaces = (
	command: ExternalFileCommand,
): ExternalFileCommand => {
	if (command.kind !== 'upsertFile') {
		return command;
	}

	return {
		...command,
		data: command.data.replace(/\s/, ''),
	};
};

describe('generate-metadata-tests', function () {
	it('should build correct files', async function (this: Context) {
		const [command] = await transform({
			'/opt/project/pages/a/index.tsx': '',
		});

		const data = buildData('a').replace(/\s/, '');

		deepStrictEqual(removeWhitespaces(command!), {
			kind: 'upsertFile',
			path: '/opt/tests/a.e2e.ts',
			data,
		});
	});

	it('should build correct files', async function (this: Context) {
		const [command] = await transform({
			'/opt/project/pages/a/[b].tsx': '',
		});

		const data = buildData('a/[b]').replace(/\s/, '');

		deepStrictEqual(removeWhitespaces(command!), {
			kind: 'upsertFile',
			path: '/opt/tests/a/[b].e2e.ts',
			data,
		});
	});

	it('should build correct files', async function (this: Context) {
		const [command] = await transform({
			'/opt/project/pages/a/[b]/c.tsx': '',
		});

		const data = buildData('a/[b]/c').replace(/\s/, '');

		deepStrictEqual(removeWhitespaces(command!), {
			kind: 'upsertFile',
			path: '/opt/tests/a/[b]/c.e2e.ts',
			data,
		});
	});
});
