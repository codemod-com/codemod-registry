import { Context } from 'mocha';
import { deepStrictEqual, ok } from 'node:assert';
import { DirectoryJSON, Volume, createFsFromVolume } from 'memfs';
import {
	FileSystemManager,
	UnifiedFileSystem,
	buildApi,
	executeRepomod,
} from '@intuita-inc/repomod-engine-api';
import { repomod } from './index.js';
import tsmorph from 'ts-morph';

const INDEX_CONTENT = `
export default function Index({}) {
	return null;
}
  
export const getStaticProps = async ({}) => {
	return {
		props: {},
	  	revalidate: 10,
	}
}
`;

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
		const externalFileCommands = await transform({
			'/opt/project/pages/index.jsx': INDEX_CONTENT,
			'/opt/project/pages/_app.jsx': '',
			'/opt/project/pages/_document.jsx': '',
			'/opt/project/pages/_error.jsx': '',
			'/opt/project/pages/_404.jsx': '',
			'/opt/project/pages/[a]/[b].tsx': A_B_CONTENT,
			'/opt/project/pages/[a]/c.tsx': A_C_CONTENT,
			'/opt/project/pages/a/index.tsx': '',
		});

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

		deepStrictEqual(externalFileCommands[1], {
			kind: 'upsertFile',
			path: '/opt/project/app/page.tsx',
			data: '// This file has been sourced from: /opt/project/pages/index.jsx\nexport default function Index({}) {\n    return null;\n}\nexport const getStaticProps = async ({}) => {\n    return {\n        props: {},\n        revalidate: 10,\n    };\n};\n',
		});

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

	it('should build neither error files nor not-found files if no such previous files were found', async function (this: Context) {
		const externalFileCommands = await transform({
			'/opt/project/pages/index.jsx': '',
			'/opt/project/pages/_app.jsx': '',
			'/opt/project/pages/_document.jsx': '',
		});

		deepStrictEqual(externalFileCommands.length, 2);

		ok(
			!externalFileCommands.some(
				(command) => command.path === '/opt/project/app/error.tsx',
			),
		);

		ok(
			!externalFileCommands.some(
				(command) => command.path === '/opt/project/app/error.jsx',
			),
		);

		ok(
			!externalFileCommands.some(
				(command) => command.path === '/opt/project/app/not-found.tsx',
			),
		);

		ok(
			!externalFileCommands.some(
				(command) => command.path === '/opt/project/app/not-found.jsx',
			),
		);
	});
});
