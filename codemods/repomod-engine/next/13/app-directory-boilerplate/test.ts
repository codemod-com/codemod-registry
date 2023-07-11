import { Context } from 'mocha';
import { deepStrictEqual, ok } from 'node:assert';
import { Volume, createFsFromVolume } from 'memfs';
import {
	FileSystemManager,
	UnifiedFileSystem,
	buildApi,
	executeRepomod,
} from '@intuita-inc/repomod-engine-api';
import { repomod } from './index.js';
import tsmorph from 'ts-morph';

const A_B_CONTENT = `
import { X } from "../../testABC";
import { Y } from "./testDEF";

export const getStaticPath = () => {

}
`;

const A_C_CONTENT = `
export const getServerSideProps = () => {

}
`;

const transform = async () => {
	const volume = Volume.fromJSON({
		'/opt/project/pages/index.jsx': '',
		'/opt/project/pages/_app.jsx': '',
		'/opt/project/pages/_document.jsx': '',
		'/opt/project/pages/_error.jsx': '',
		'/opt/project/pages/[a]/[b].tsx': A_B_CONTENT,
		'/opt/project/pages/[a]/c.tsx': A_C_CONTENT,
		'/opt/project/pages/a/index.tsx': '',
	});

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
		tsmorph: typeof tsmorph;
	}>(unifiedFileSystem, () => ({
		tsmorph,
	}));

	return executeRepomod(api, repomod, '/', {});
};

const A_B_DATA = `// This file has been sourced from: /opt/project/pages/[a]/[b].tsx
import { X } from "../../../testABC";
import { Y } from "../testDEF";
export default function RoutePage({ params, }: {
    params: {};
}) {
    return <RouteClientComponent />;
}
// TODO reimplement getStaticPath as generateStaticParams
export const getStaticPath = () => {
};
`;

const A_C_DATA = `// This file has been sourced from: /opt/project/pages/[a]/c.tsx
export default function RoutePage({ params, }: {
    params: {};
}) {
    return <RouteClientComponent />;
}
// TODO reimplement getServerSideProps with custom logic
export const getServerSideProps = () => {
};
`;

describe('next 13 app-directory-boilerplate', function () {
	it('should build correct files', async function (this: Context) {
		const externalFileCommands = await transform();

		deepStrictEqual(externalFileCommands.length, 10);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/layout.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/error.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/not-found.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/page.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) =>
					command.path === '/opt/project/app/[a]/[b]/layout.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) =>
					command.path === '/opt/project/app/[a]/[b]/page.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) =>
					command.path === '/opt/project/app/[a]/c/layout.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/[a]/c/page.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/a/page.tsx',
			),
		);

		ok(
			externalFileCommands.some(
				(command) => command.path === '/opt/project/app/a/layout.tsx',
			),
		);

		deepStrictEqual(externalFileCommands[8], {
			kind: 'upsertFile',
			path: '/opt/project/app/[a]/[b]/page.tsx',
			data: A_B_DATA,
		});

		deepStrictEqual(externalFileCommands[6], {
			kind: 'upsertFile',
			path: '/opt/project/app/[a]/c/page.tsx',
			data: A_C_DATA,
		});
	});
});
