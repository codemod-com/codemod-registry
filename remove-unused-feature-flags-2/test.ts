import {
	FileSystemManager,
	UnifiedFileSystem,
	buildApi,
	executeRepomod,
} from '@intuita-inc/repomod-engine-api';
import jscodeshift from 'jscodeshift';
import { DirectoryJSON, Volume, createFsFromVolume } from 'memfs';
import { repomod } from './index.js';
import { Context } from 'mocha';
import { deepStrictEqual } from 'node:assert';

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

	const api = buildApi<{
		jscodeshift: typeof jscodeshift;
	}>(unifiedFileSystem, () => ({
		jscodeshift,
	}));

	return executeRepomod(
		api,
		repomod,
		'/',
		{
			fileMarker: 'marker',
			featureFlagName: 'featureFlagA',
			functionName: 'buildFeatureFlag',
		},
		{},
	);
};

const directoryJSON: DirectoryJSON = {
	'/opt/project/featureFlags.ts': `
		const marker = 'marker';

		export const featureFlagObject = buildFeatureFlag({
			key: 'featureFlagA',
		});
	`,
	'/opt/project/component.ts': `
		export async function Component() {
			const a = await featureFlagObject();
		}
	`,
};

describe('remove unused feature flags 2', function () {
	it('should build correct files', async function (this: Context) {
		const externalFileCommands = await transform(directoryJSON);

		deepStrictEqual(externalFileCommands.length, 1);

		deepStrictEqual(externalFileCommands[0], {
			kind: 'upsertFile',
			path: '/opt/project/component.ts',
			data: '\n\t\texport async function Component() {\n\t\t\tconst a = true;\n\t\t}\n\t',
		});
	});
});
