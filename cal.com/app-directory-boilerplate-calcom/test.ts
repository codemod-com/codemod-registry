import { Context } from 'mocha';
import { deepStrictEqual, ok } from 'node:assert';
import { DirectoryJSON, Volume, createFsFromVolume } from 'memfs';
import {
	FileSystemManager,
	UnifiedFileSystem,
	buildApi,
	executeFilemod,
} from '@intuita-inc/filemod';
import { LAYOUT_CONTENT, repomod } from './index.js';
import tsmorph from 'ts-morph';

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

	const api = buildApi<{
		tsmorph: typeof tsmorph;
	}>(unifiedFileSystem, () => ({
		tsmorph,
	}));

	return executeFilemod(api, repomod, '/', {}, {});
};

describe('cal.com app-directory-boilerplate-calcom', function () {
	it('should build correct files', async function (this: Context) {
		const externalFileCommands = await transform({
			'/opt/project/pages/a/index.tsx': 'TODO content',
			'/opt/project/pages/a/b.tsx': 'TODO content',
			'/opt/project/pages/a/[b]/c.tsx': 'TODO content',
		});

		deepStrictEqual(externalFileCommands.length, 9);

		ok(
			externalFileCommands.some(
				(command) =>
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/app/a/page.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) =>
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/app/a/layout.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) =>
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/pages/a/index.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) =>
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/app/a/b/page.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) =>
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/app/a/b/layout.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) =>
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/pages/a/b.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) =>
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/app/a/[b]/c/page.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) =>
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/app/a/[b]/c/layout.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) =>
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/pages/a/[b]/c.tsx',
			),
		);

		ok(
			externalFileCommands.some((command) => {
				return (
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/app/a/page.tsx' &&
					command.data.replace(/\W/gm, '') ===
						`
						import Page from "@pages/a/index";
						// TODO add metadata
						export default Page;
					`.replace(/\W/gm, '')
				);
			}),
		);

		ok(
			externalFileCommands.some((command) => {
				return (
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/app/a/layout.tsx' &&
					command.data.replace(/\W/gm, '') ===
						LAYOUT_CONTENT.replace(/\W/gm, '')
				);
			}),
		);

		ok(
			externalFileCommands.some((command) => {
				return (
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/pages/a/index.tsx' &&
					command.data.replace(/\W/gm, '') ===
						`
						'use client';
						TODO content
						`.replace(/\W/gm, '')
				);
			}),
		);

		ok(
			externalFileCommands.some((command) => {
				return (
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/app/a/b/page.tsx' &&
					command.data.replace(/\W/gm, '') ===
						`
						import Page from "@pages/a/b";
						// TODO add metadata
						export default Page;
					`.replace(/\W/gm, '')
				);
			}),
		);

		ok(
			externalFileCommands.some((command) => {
				return (
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/app/a/b/layout.tsx' &&
					command.data.replace(/\W/gm, '') ===
						LAYOUT_CONTENT.replace(/\W/gm, '')
				);
			}),
		);

		ok(
			externalFileCommands.some((command) => {
				return (
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/pages/a/b.tsx' &&
					command.data.replace(/\W/gm, '') ===
						`
						'use client';
						TODO content
						`.replace(/\W/gm, '')
				);
			}),
		);

		ok(
			externalFileCommands.some((command) => {
				return (
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/app/a/[b]/c/page.tsx' &&
					command.data.replace(/\W/gm, '') ===
						`
						import Page from "@pages/a/[b]/c";
						// TODO add metadata
						export default Page;
					`.replace(/\W/gm, '')
				);
			}),
		);

		ok(
			externalFileCommands.some((command) => {
				return (
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/app/a/[b]/c/layout.tsx' &&
					command.data.replace(/\W/gm, '') ===
						LAYOUT_CONTENT.replace(/\W/gm, '')
				);
			}),
		);

		ok(
			externalFileCommands.some((command) => {
				return (
					command.kind === 'upsertFile' &&
					command.path === '/opt/project/pages/a/[b]/c.tsx' &&
					command.data.replace(/\W/gm, '') ===
						`
						'use client';
						TODO content
						`.replace(/\W/gm, '')
				);
			}),
		);
	});
});