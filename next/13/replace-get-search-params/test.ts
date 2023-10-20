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
			useCompatSearchParamsHookAbsolutePath:
				'/opt/project/hooks/useCompatSearchParams.tsx',
			useCompatSearchParamsHookModuleSpecifier:
				'hooks/useCompatSearchParams.tsx',
		},
		{},
	);
};

describe('next 13 replace-replace-get-search-params', function () {
	it('should replace useSearchParams with useCompatSearchParams', async function (this: Context) {
		const A_CONTENT = `
			import { useSearchParams, useParams } from 'next/navigation';

			export default function C() {
				const s = useSearchParams();

				return null;
			}
`;

		const [upsertHookCommand, upsertFileCommand] = await transform({
			'/opt/project/components/a.tsx': A_CONTENT,
		});

		const expectedResult = `
		import { useCompatSearchParams } from "hooks/useCompatSearchParams.tsx";
		import { useParams } from 'next/navigation';

			export default function C() {
				const s = useCompatSearchParams();

				return null;
			}
		`;

		deepStrictEqual(upsertHookCommand?.kind, 'upsertFile');
		deepStrictEqual(
			upsertHookCommand.path,
			'/opt/project/hooks/useCompatSearchParams.tsx',
		);

		deepStrictEqual(upsertFileCommand?.kind, 'upsertFile');
		deepStrictEqual(
			upsertFileCommand.path,
			'/opt/project/components/a.tsx',
		);

		deepStrictEqual(
			upsertFileCommand.data.replace(/\s/gm, ''),
			expectedResult.replace(/\s/gm, ''),
		);
	});

	it('should remove next/navigation import if no specifiers left after useSearchParams specifier removal', async function (this: Context) {
		const A_CONTENT = `
			import { useSearchParams } from 'next/navigation';

			export default function C() {
				const s = useSearchParams();

				return null;
			}
`;

		const [, upsertFileCommand] = await transform({
			'/opt/project/components/a.tsx': A_CONTENT,
		});

		const expectedResult = `
		import { useCompatSearchParams } from "hooks/useCompatSearchParams.tsx";

			export default function C() {
				const s = useCompatSearchParams();

				return null;
			}
		`;

		deepStrictEqual(upsertFileCommand?.kind, 'upsertFile');
		deepStrictEqual(
			upsertFileCommand.path,
			'/opt/project/components/a.tsx',
		);

		deepStrictEqual(
			upsertFileCommand.data.replace(/\s/gm, ''),
			expectedResult.replace(/\s/gm, ''),
		);
	});
});
