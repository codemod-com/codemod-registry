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
	it('should split single handler to method handlers: should support all HTTP methods ', async function (this: Context) {
		const A_CONTENT = `
		export default function handler() {
			if(req.method === 'GET') {
				// GET block
			}
			
			if (req.method === 'POST') {
				// POST block
			} 
			
			if(req.method === 'PUT') {
				// PUT block
			}
			
			if(req.method === 'DELETE') {
				// DELETE block
			}
			
			if(req.method === 'PATCH') {
				// PATCH block
			}
		}
	`;

		const [upsertFileCommand] = await transform({
			'/opt/project/pages/api/hello.ts': A_CONTENT,
		});

		const expectedResult = `
		export async function PATCH() {
			// PATCH block
		}
		export async function DELETE() {
				// DELETE block
		}
		export async function PUT() {
				// PUT block
		}
		export async function POST() {
				// POST block
		}
		export async function GET() {
				// GET block
		}
		`;

		deepStrictEqual(upsertFileCommand?.kind, 'upsertFile');
		deepStrictEqual(upsertFileCommand.path, '/opt/project/app/api/hello/route.ts');

		deepStrictEqual(
			upsertFileCommand.data.replace(/\W/gm, ''),
			expectedResult.replace(/\W/gm, ''),
		);
	});
	
	it('should rewrite response callExpressions: support chained call expressions', async function (this: Context) {
		const A_CONTENT = `
		export default function handler(req, res) {
			if(req.method === 'GET') {
				res.status(1).json({ })
			}
		}
	`;

		const [upsertFileCommand] = await transform({
			'/opt/project/pages/api/hello.ts': A_CONTENT,
		});

		const expectedResult = `
		import { NextResponse } from 'next/server';
		
		export async function GET(req, res) {
				return NextResponse.json({ }, { "status": "1" })
		}
		`;

		deepStrictEqual(upsertFileCommand?.kind, 'upsertFile');
		deepStrictEqual(upsertFileCommand.path, '/opt/project/app/api/hello/route.ts');

		console.log(upsertFileCommand.data, '?')
		deepStrictEqual(
			upsertFileCommand.data.replace(/\W/gm, ''),
			expectedResult.replace(/\W/gm, ''),
		);
	});
});
