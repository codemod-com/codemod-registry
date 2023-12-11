import { Context } from 'mocha';
import { deepStrictEqual } from 'node:assert';
import { DirectoryJSON, Volume, createFsFromVolume } from 'memfs';
import {
	FileSystemManager,
	UnifiedFileSystem,
	buildApi,
	executeFilemod,
} from '@intuita-inc/filemod';
import { repomod } from '../src/index.js';
import jscodeshift from 'jscodeshift';

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

	const api = buildApi<{ jscodeshift: typeof jscodeshift }>(
		unifiedFileSystem,
		() => ({
			jscodeshift,
		}),
		'/',
	);

	return executeFilemod(api, repomod, '/', {}, {});
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
		data: command.data.replace(/\s/gm, ''),
	};
};

describe('ab-test', function () {
	it('should build correct files', async function (this: Context) {
		const [middlewareTsCommand, abTestMiddlewareTsCommand] =
			await transform({
				'/opt/project/middleware.ts': `
				const middleware = async () => {};
				export default middleware;
				`,
			});

		deepStrictEqual(
			removeWhitespaces(middlewareTsCommand!),
			removeWhitespaces({
				kind: 'upsertFile',
				path: '/opt/project/middleware.ts',
				data: `
			import { abTestMiddlewareFactory } from "abTestMiddlewareFactory";
			const middleware = async () => {};
			export default abTestMiddlewareFactory(middleware);
			`,
			}),
		);

		deepStrictEqual(abTestMiddlewareTsCommand.kind, 'upsertFile');
		deepStrictEqual(
			abTestMiddlewareTsCommand.path,
			'/opt/project/abTestMiddlewareFactory.ts',
		);
	});
});
