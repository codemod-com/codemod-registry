import { Context } from 'mocha';
import { DirectoryJSON, Volume, createFsFromVolume } from 'memfs';
import {
	FileSystemManager,
	UnifiedFileSystem,
	buildApi,
	executeRepomod,
} from '@intuita-inc/repomod-engine-api';
import { repomod } from './index.js';
import tsmorph from 'ts-morph';
import { deepStrictEqual } from 'node:assert';

const transform = async (json: DirectoryJSON) => {
	const volume = Volume.fromJSON(json);

	const fileSystemManager = new FileSystemManager(
		volume.promises.readdir as any,
		volume.promises.readFile as any,
		volume.promises.stat as any,
	);

	const fileSystem = createFsFromVolume(volume) as any;

	const unifiedFileSystem = new UnifiedFileSystem(
		fileSystem,
		fileSystemManager,
	);

	
	const api = buildApi<{
		tsmorph: typeof tsmorph;
		unifiedFileSystem: UnifiedFileSystem;
	}>(unifiedFileSystem, () => ({
		tsmorph,
		unifiedFileSystem,
	}));

	return executeRepomod(api, repomod, '/', {});
};

describe.only('next 13 replace-API-routes', function () {
	it('should find and extract code blocks related to HTTP method', async function (this: Context) {
		const A_CONTENT = `
		import type { NextApiRequest, NextApiResponse } from 'next'
 
		export default function handler(req: NextApiRequest, res: NextApiResponse) {
			if (req.method === 'POST') {
				res.status(200).json({ message: 'Hello from Next.js!' })
			} 
		}
	`;

		const [upsertFileCommand] = await transform({
			'/opt/project/pages/api/hello.ts': A_CONTENT,
		});

		const expectedResult = `import { NextResponse } from 'next/server'
 
		export async function POST() {
			return NextResponse.json({ message: 'Hello from Next.js!' })
		}`;

		deepStrictEqual(upsertFileCommand?.kind, 'upsertFile');
		deepStrictEqual(upsertFileCommand.path, '/opt/project/app/api/hello/route.ts');
		
		console.log(upsertFileCommand, '?')
	
		
		deepStrictEqual(
			upsertFileCommand.data.replace(/\W/gm, ''),
			expectedResult.replace(/\W/gm, ''),
		);
	});
});
