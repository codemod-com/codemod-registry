import {
	FileSystemManager,
	UnifiedFileSystem,
	buildApi,
	executeFilemod,
} from '@intuita-inc/filemod';
import jscodeshift from 'jscodeshift';
import { DirectoryJSON, Volume, createFsFromVolume } from 'memfs';
import { repomod } from './index.js';
import { Context } from 'mocha';
import { deepStrictEqual } from 'node:assert';

type Options = Readonly<{
	hookModuleCreation?: boolean;
}>;

const transform = async (json: DirectoryJSON, options: Options) => {
	const volume = Volume.fromJSON(json);

	const fileSystemManager = new FileSystemManager(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		volume.promises.readdir as any,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		volume.promises.readFile as any,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		volume.promises.stat as any,
	);
	const unifiedFileSystem = new UnifiedFileSystem(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		createFsFromVolume(volume) as any,
		fileSystemManager,
	);

	const api = buildApi<{
		jscodeshift: typeof jscodeshift;
	}>(
		unifiedFileSystem,
		() => ({
			jscodeshift,
		}),
		'/opt/project',
	);

	return executeFilemod(
		api,
		repomod,
		'/',
		{
			useCompatSearchParamsHookRelativePath:
				'hooks/useCompatSearchParams.tsx',
			useCompatSearchParamsHookModuleSpecifier:
				'hooks/useCompatSearchParams.tsx',
			hookModuleCreation: options.hookModuleCreation,
		},
		{},
	);
};

describe('next 13 replace-replace-use-search-params', function () {
	it('should replace useSearchParams with useCompatSearchParams', async function (this: Context) {
		const A_CONTENT = `
			import { useSearchParams, useParams } from 'next/navigation';

			export default function C() {
				const s = useSearchParams();

				return null;
			}
		`;

		const [upsertHookCommand, upsertFileCommand] = await transform(
			{
				'/opt/project/components/a.tsx': A_CONTENT,
			},
			{},
		);

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

	it('should replace useSearchParams with useCompatSearchParams but not create the hook file', async function (this: Context) {
		const A_CONTENT = `
			import { useSearchParams, useParams } from 'next/navigation';

			export default function C() {
				const s = useSearchParams();

				return null;
			}
`;

		const [upsertFileCommand] = await transform(
			{
				'/opt/project/components/a.tsx': A_CONTENT,
			},
			{
				hookModuleCreation: false,
			},
		);

		const expectedResult = `
		import { useCompatSearchParams } from "hooks/useCompatSearchParams.tsx";
		import { useParams } from 'next/navigation';

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

	it('should remove next/navigation import if no specifiers left after useSearchParams specifier removal', async function (this: Context) {
		const A_CONTENT = `
			import { useSearchParams } from 'next/navigation';

			export default function C() {
				const s = useSearchParams();

				return null;
			}
`;

		const [, upsertFileCommand] = await transform(
			{
				'/opt/project/components/a.tsx': A_CONTENT,
			},
			{},
		);

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

	it('should replace useSearchParams with useCompatSearchParams without creating the hook file', async function (this: Context) {
		const A_CONTENT = `
			import { useSearchParams, useParams } from 'next/navigation';

			export default function C() {
				const s = useSearchParams();

				return null;
			}
`;

		const [upsertFileCommand] = await transform(
			{
				'/opt/project/components/a.tsx': A_CONTENT,
				'/opt/project/hooks/useCompatSearchParams.tsx': '',
			},
			{},
		);

		const expectedResult = `
		import { useCompatSearchParams } from "hooks/useCompatSearchParams.tsx";
		import { useParams } from 'next/navigation';

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
