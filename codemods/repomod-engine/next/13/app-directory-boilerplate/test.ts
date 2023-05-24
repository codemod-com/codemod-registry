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
import tsmorph from 'ts-morph';

const A_B_CONTENT = `
import { X } from "../../testABC";

export const getServerSideProps = () => {

}
`;

const transform = async () => {
	const volume = Volume.fromJSON({
		'/opt/project/pages/index.jsx': '',
		'/opt/project/pages/_app.jsx': '',
		'/opt/project/pages/_document.jsx': '',
		'/opt/project/pages/_error.jsx': '',
		'/opt/project/pages/[a]/[b].tsx': A_B_CONTENT,
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

	const api = buildApi<{
		tsmorph: typeof tsmorph;
	}>(unifiedFileSystem, () => ({
		tsmorph,
	}));

	return executeRepomod(api, repomod, '/', {});
};

describe('next 13 app-directory-boilerplate', function () {
	it('should build correct files', async function (this: Context) {
		const externalFileCommands = await transform();

		deepStrictEqual(externalFileCommands.length, 8);

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
					command.path === '/opt/project/app/[a]/[b]/layout.tsx',
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
				(command) =>
					command.path === '/opt/project/app/[a]/c/layout.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/[a]/c/page.tsx',
			),
		);
	});
});
