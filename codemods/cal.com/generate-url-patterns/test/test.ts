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

const transform = async (
	json: DirectoryJSON,
	options: {
		turboPath: string;
		abTestMiddlewarePath: string;
		middlewarePath: string;
		generateAsPageGroup?: boolean;
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
		const [
			turboJsonCommand,
			middlewareTsCommand,
			abTestMiddlewareTsCommand,
		] = await transform(
			{
				'/opt/project/turbo.json': JSON.stringify({
					globalEnv: ['OTHER_ENVVAR'],
				}),
				'/opt/project/abTestMiddleware.ts': `
					import { type X } from 'y';
					const other = true;
				`,
				'/opt/project/middleware.ts': `
					export const config = {
						matcher: [
							"otherPath", 
						]
					}
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
				abTestMiddlewarePath: '/opt/project/abTestMiddleware.ts',
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
			removeWhitespaces(abTestMiddlewareTsCommand!),
			removeWhitespaces({
				kind: 'upsertFile',
				path: '/opt/project/abTestMiddleware.ts',
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

		deepStrictEqual(
			removeWhitespaces(middlewareTsCommand!),
			removeWhitespaces({
				kind: 'upsertFile',
				path: '/opt/project/middleware.ts',
				data: `
				export const config = {
					matcher: [
						"otherPath", 
						"/noSegment",
						"/future/noSegment/",

						"/dynamicSegment/:a",
						"/future/dynamicSegment/:a/",

						"/catchAllDynamicSegments/:d+",
						"/future/catchAllDynamicSegments/:d+/",

						"/dynamicSegment/:b/:c",
						"/future/dynamicSegment/:b/:c/",

						"/optionalCatchAllDynamicSegments/:element*/f", 
						"/future/optionalCatchAllDynamicSegments/:element*/f/"
					]
				}
			`,
			}),
		);
	});

	it('should support generateAsPageGroup option', async function (this: Context) {
		const [turboJsonCommand, abTestMiddlewareTsCommand] = await transform(
			{
				'/opt/project/turbo.json': JSON.stringify({
					globalEnv: ['OTHER_ENVVAR'],
				}),
				'/opt/project/abTestMiddleware.ts': `
					import { type X } from 'y';
					const other = true;
				`,
				'/opt/project/app/future/top-level/page.tsx': '',
				'/opt/project/app/future/top-level/a/page.tsx': '',
				'/opt/project/app/future/top-level/b/page.tsx': '',
				'/opt/project/app/future/top-level/a/b/page.tsx': '',
			},
			{
				turboPath: '/opt/project/turbo.json',
				abTestMiddlewarePath: '/opt/project/abTestMiddleware.ts',
				middlewarePath: '/opt/project/middleware.ts',
				generateAsPageGroup: true,
			},
		);

		const data = JSON.stringify({
			globalEnv: ['APP_ROUTER_TOP_LEVEL_ENABLED', 'OTHER_ENVVAR'],
		});

		deepStrictEqual(removeWhitespaces(turboJsonCommand!), {
			kind: 'upsertFile',
			path: '/opt/project/turbo.json',
			data,
		});

		deepStrictEqual(
			removeWhitespaces(abTestMiddlewareTsCommand!),
			removeWhitespaces({
				kind: 'upsertFile',
				path: '/opt/project/abTestMiddleware.ts',
				data: `import { type X } from 'y';
				const other = true;

				const ROUTES: [URLPattern, boolean][] = [
					[
						"/top-level/:path*",
						Boolean(process.env.APP_ROUTER_TOP_LEVEL_ENABLED)
					] as const
				].map(([pathname, enabled]) => [new URLPattern({
					pathname
				}), enabled]);`,
			}),
		);
	});
});
