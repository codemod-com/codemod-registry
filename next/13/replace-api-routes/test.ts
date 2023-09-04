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

describe('next 13 replace-API-routes', function () {
	it('should transform API router handler: functionDeclaration', async function (this: Context) {
		const A_CONTENT = `
		export default function handler() {
			if(req.method === 'GET') {
				// GET block
			}
		}
	`;

		const [upsertFileCommand] = await transform({
			'/opt/project/pages/api/hello.ts': A_CONTENT,
		});

		const expectedResult = `
		import { type NextRequest, NextResponse } from 'next/server';
		
		export async function GET() {
				// GET block
		}
		`;

		deepStrictEqual(upsertFileCommand?.kind, 'upsertFile');
		deepStrictEqual(
			upsertFileCommand.path,
			'/opt/project/app/api/hello/route.ts',
		);

		deepStrictEqual(
			upsertFileCommand.data.replace(/\W/gm, ''),
			expectedResult.replace(/\W/gm, ''),
		);
	});

	it('should transform API router handler: arrow function', async function (this: Context) {
		const A_CONTENT = `
			const handler = () => {
				if(req.method === 'GET') {
					// GET block
				}
			}
			
			export default handler;
	`;

		const [upsertFileCommand] = await transform({
			'/opt/project/pages/api/hello.ts': A_CONTENT,
		});

		const expectedResult = `
		import { type NextRequest, NextResponse } from 'next/server';
		
		export async function GET() {
				// GET block
		}
		`;

		deepStrictEqual(upsertFileCommand?.kind, 'upsertFile');
		deepStrictEqual(
			upsertFileCommand.path,
			'/opt/project/app/api/hello/route.ts',
		);

		deepStrictEqual(
			upsertFileCommand.data.replace(/\W/gm, ''),
			expectedResult.replace(/\W/gm, ''),
		);
	});

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
		import { type NextRequest, NextResponse } from 'next/server';
		
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
		deepStrictEqual(
			upsertFileCommand.path,
			'/opt/project/app/api/hello/route.ts',
		);

		deepStrictEqual(
			upsertFileCommand.data.replace(/\W/gm, ''),
			expectedResult.replace(/\W/gm, ''),
		);
	});

	/**
	 * const a = 1;
	 * const b = 1;
	 * if (req.method === 'GET' && a === b) {
	 * // GET block
	 * }
	 *
	 * =>
	 *
	 * export function GET() {
	 * const a = 1;
	 * const b = 1;
	 * if(a === b) {
	 * // GET block
	 * }
	 * }
	 */
	it(
		'should split single handler to method handlers: should support nested binary expressions and external refs',
	);

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
		import { type NextRequest, NextResponse } from 'next/server';
		
		export async function GET(req: NextRequest) {
				return NextResponse.json({ }, { "status": "1" })
		}
		`;

		deepStrictEqual(upsertFileCommand?.kind, 'upsertFile');
		deepStrictEqual(
			upsertFileCommand.path,
			'/opt/project/app/api/hello/route.ts',
		);

		deepStrictEqual(
			upsertFileCommand.data.replace(/\W/gm, ''),
			expectedResult.replace(/\W/gm, ''),
		);
	});

	/**
	 * export default function handler(req, res) {
			if(req.method === 'GET') {
				res
				.setHeader('a', ['b', 'c'])
				.setHeader('a', ['b1', 'c1']).json({ })
			}
		}
		
		=> 
		import { type NextRequest, NextResponse } from 'next/server';
		
		export async function GET(req: NextRequest) {
				return NextResponse.json({ }, { "headers": { "a": "b1, c1" })
		}
	 */

	it('should rewrite response callExpressions: support setHeader');

	/**
	 * 	export default function handler(req, res) {
			if(req.method === 'GET') {
				res
				.appendHeader('a', ['b', 'c'])
				.appendHeader('a', ['b1', 'c1']).json({ })
			}
		} 
		=>
		
		import { type NextRequest, NextResponse } from 'next/server';
		
		export async function GET(req: NextRequest) {
				return NextResponse.json({ }, { "headers": { "a": "b, c, b1, c1" })
		}
	 */
	it('should rewrite response callExpressions: support appendHeader');

	it(
		'should rewrite response callExpressions: support res.statusCode assignment',
	);
});
