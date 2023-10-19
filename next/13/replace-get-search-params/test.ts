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
			hookPath: '/opt/project/hooks',
		},
		{},
	);
};

describe('next 13 replace-replace-get-search-params', function () {
	it('should support mdx files', async function (this: Context) {
		const A_CONTENT = `
			import { useSearchParams } from 'next/navigation';

			export default function C() {
				const s = useSearchParams();

				return null;
			}
`;

		const [command, c2] = await transform({
			'/opt/project/components/a.tsx': A_CONTENT,
		});

		console.log(command, c2, '?');
		const expectedResult = `
		import { useCompatSearchParams } from "/opt/project/hooks/useCompatSearchParams";

			export default function C() {
				const s = useCompatSearchParams();

				return null;
			}
		`;

		deepStrictEqual(command?.kind, 'upsertFile');
		deepStrictEqual(command.path, '/opt/project/components/a.tsx');

		deepStrictEqual(
			command.data.replace(/\s/gm, ''),
			expectedResult.replace(/\s/gm, ''),
		);
	});
});
