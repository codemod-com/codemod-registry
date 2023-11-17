import { Context } from 'mocha';
import { deepStrictEqual } from 'node:assert';
import { DirectoryJSON, Volume, createFsFromVolume } from 'memfs';
import {
	FileSystemManager,
	UnifiedFileSystem,
	buildApi,
	executeFilemod,
} from '@intuita-inc/filemod';
import { repomod } from './index.js';
import jscodeshift from 'jscodeshift';

const transform = async (
	json: DirectoryJSON,
	options: {
		turboPath: string;
		middlewarePath: string;
	},
) => {
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

	return executeFilemod(api, repomod, '/', options, {});
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

describe('generate-url-patterns', function () {
	it('should build correct files', async function (this: Context) {
		const [turboJsonCommand, middlewareTsCommand] = await transform(
			{
				'/opt/project/turbo.json': JSON.stringify({
					globalEnv: ['OTHER_ENVVAR'],
				}),
				'/opt/project/middleware.ts': `
					import { type X } from 'y';
					const other = true;
				`,
				'/opt/project/app/future/noSegment/page.tsx': '',
				'/opt/project/app/future/dynamicSegment/[a]/page.tsx': '',
				'/opt/project/app/future/dynamicSegment/[b]/[c]/page.tsx': '',
				'/opt/project/app/future/catchAllDynamicSegments/[...d]/page.tsx':
					'',
				'/opt/project/app/future/(someLayout)/optionalCatchAllDynamicSegments/[[...element]]/f/page.tsx':
					'',
			},
			{
				turboPath: '/opt/project/turbo.json',
				middlewarePath: '/opt/project/middleware.ts',
			},
		);

		const data = JSON.stringify({
			globalEnv: [
				'APP_ROUTER_CATCHALLDYNAMICSEGMENTS_D_ENABLED',
				'APP_ROUTER_DYNAMICSEGMENT_A_ENABLED',
				'APP_ROUTER_DYNAMICSEGMENT_B_C_ENABLED',
				'APP_ROUTER_NOSEGMENT_ENABLED',
				'APP_ROUTER_OPTIONALCATCHALLDYNAMICSEGMENTS_ELEMENT_F_ENABLED',
				'OTHER_ENVVAR',
			],
		});

		deepStrictEqual(removeWhitespaces(turboJsonCommand!), {
			kind: 'upsertFile',
			path: '/opt/project/turbo.json',
			data,
		});

		deepStrictEqual(
			removeWhitespaces(middlewareTsCommand!),
			removeWhitespaces({
				kind: 'upsertFile',
				path: '/opt/project/middleware.ts',
				data: `import { type X } from 'y';
				const other = true;

				const ROUTES: [URLPattern, boolean][] = [
					[
						"/catchAllDynamicSegments/:d+",
						Boolean(process.env.APP_ROUTER_CATCHALLDYNAMICSEGMENTS_D_ENABLED)
					] as const,
					[
						"/dynamicSegment/:a",
						Boolean(process.env.APP_ROUTER_DYNAMICSEGMENT_A_ENABLED)
					] as const,
					[
						"/dynamicSegment/:b/:c",
						Boolean(process.env.APP_ROUTER_DYNAMICSEGMENT_B_C_ENABLED)
					] as const,
					["/noSegment", Boolean(process.env.APP_ROUTER_NOSEGMENT_ENABLED)] as const,
					[
						"/optionalCatchAllDynamicSegments/:element*/f",
						Boolean(process.env.APP_ROUTER_OPTIONALCATCHALLDYNAMICSEGMENTS_ELEMENT_F_ENABLED)
					] as const
				].map(([pathname, enabled]) => [new URLPattern({
					pathname
				}), enabled]);
`,
			}),
		);
	});
});
