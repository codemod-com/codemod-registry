import { buildApi, executeFilemod } from '@intuita-inc/filemod';
import { describe, it } from 'vitest';
import jscodeshift from 'jscodeshift';
import { DirectoryJSON, Volume, createFsFromVolume } from 'memfs';
import { repomod } from '../src/index.js';
import { deepStrictEqual } from 'node:assert';
import {
	buildUnifiedFileSystem,
	buildPathAPI,
} from '@codemod-registry/utilities';

const transform = async (json: DirectoryJSON) => {
	const volume = Volume.fromJSON(json);

	const fs = createFsFromVolume(volume);

	const unifiedFileSystem = buildUnifiedFileSystem(fs);
	const pathApi = buildPathAPI('/');

	const api = buildApi<{
		jscodeshift: typeof jscodeshift;
	}>(
		unifiedFileSystem,
		() => ({
			jscodeshift,
		}),
		pathApi,
	);

	return executeFilemod(
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
	it('should build correct files', async function () {
		const externalFileCommands = await transform(directoryJSON);

		deepStrictEqual(externalFileCommands.length, 1);

		deepStrictEqual(externalFileCommands[0], {
			kind: 'upsertFile',
			path: '/opt/project/component.ts',
			data: '\n\t\texport async function Component() {\n\t\t\tconst a = true;\n\t\t}\n\t',
		});
	});
});
