import { Context } from 'mocha';
import { deepStrictEqual } from 'node:assert';
import { DirectoryJSON, Volume, createFsFromVolume } from 'memfs';
import {
	FileSystemManager,
	UnifiedFileSystem,
	buildApi,
	executeFilemod,
} from '@intuita-inc/filemod';
import { buildData, repomod } from './index.js';

const transform = async (json: DirectoryJSON) => {
	const volume = Volume.fromJSON(json);

	const fileSystemManager = new FileSystemManager(
		// @ts-expect-error type convergence
		volume.promises.readdir,
		volume.promises.readFile,
		volume.promises.stat,
	);
	const unifiedFileSystem = new UnifiedFileSystem(
		// @ts-expect-error type convergence
		createFsFromVolume(volume),
		fileSystemManager,
	);

	const api = buildApi<Record<string, never>>(unifiedFileSystem, () => ({}));

	return executeFilemod(api, repomod, '/', { testPath: '/opt/tests' }, {});
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
