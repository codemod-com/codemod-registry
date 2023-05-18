import { Context } from 'mocha';
import { deepStrictEqual, ok } from 'node:assert';
import { Volume } from 'memfs';
import {
	FileSystemManager,
	UnifiedFileSystem,
	buildApi,
	executeRepomod,
} from '@intuita-inc/repomod-engine-api';
import { repomod } from './index.js';

const transform = async () => {
	const volume = Volume.fromJSON({
		'/opt/project/pages/index.jsx': '',
		'/opt/project/pages/_app.jsx': '',
		'/opt/project/pages/_document.jsx': '',
		'/opt/project/pages/_error.jsx': '',
		'/opt/project/pages/[a]/[b].tsx': '',
		'/opt/project/pages/[a]/c.tsx': '',
	});

	const fileSystemManager = new FileSystemManager(
		volume.promises.readdir as any,
		volume.promises.readFile as any,
		volume.promises.stat as any,
	);
	const unifiedFileSystem = new UnifiedFileSystem(
		volume as any,
		fileSystemManager,
	);

	const api = buildApi<{}>(unifiedFileSystem, () => ({}));

	return executeRepomod(api, repomod, '/', {});
};

describe.only('next 13 app-directory-boilerplate', function () {
	it('should return correct files', async function (this: Context) {
		const externalFileCommands = await transform();

		// deepStrictEqual(externalFileCommands.length, 6);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/layout.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/error.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/not-found.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/page.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) =>
					command.path === '/opt/project/app/[a]/[b]/page.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/[a]/c/page.tsx',
			),
		);
	});
});
