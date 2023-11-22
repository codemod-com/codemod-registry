import {
	Filemod,
	HandleData,
	HandleFile,
	HandleFinish,
	InitializeState,
} from '@intuita-inc/filemod';
import { parse, sep, format } from 'node:path';

type Dependencies = Record<string, never>;
type State = {
	step: 'UPSERTING_CODEMODS' | 'UPSERTING_WORKSPACES';
	workspaces: Set<string>;
};

const isNeitherNullNorUndefined = <T>(
	t: NonNullable<T> | null | undefined,
): t is NonNullable<T> => t !== null && t !== undefined;

const initializeState: InitializeState<State> = async (_, state) => {
	if (state === null) {
		return {
			step: 'UPSERTING_CODEMODS',
			workspaces: new Set(),
		};
	}

	return {
		step: 'UPSERTING_WORKSPACES',
		workspaces: state.workspaces,
	};
};

type FileCommand = Awaited<ReturnType<HandleFile<Dependencies, State>>>[number];

const handleFile: HandleFile<Dependencies, State> = async (
	api,
	path,
	options,
	state,
) => {
	const parsedCwd = parse(
		api.joinPaths(api.currentWorkingDirectory, 'placeholder.txt'),
	);
	const parsedPath = parse(path);

	const cwdDirectoryNames = parsedCwd.dir.split(sep);
	const pathDirectoryNames = parsedPath.dir.split(sep);

	if (!['.ts', '.js', '.json', '.md', '.toml'].includes(parsedPath.ext)) {
		return [];
	}

	const directoryName = pathDirectoryNames
		.map((name, i) => (name !== cwdDirectoryNames[i] ? name : null))
		.filter(isNeitherNullNorUndefined);

	if (directoryName.length === 0) {
		if (parsedPath.base === 'package.json') {
			return [
				{
					kind: 'upsertFile',
					path: api.joinPaths(
						api.currentWorkingDirectory,
						'.pnpm-workspace.yml',
					),
					options,
				},
			];
		}

		return [];
	}

	const newPath = api.joinPaths(
		api.currentWorkingDirectory,
		'codemods',
		...directoryName,
		parsedPath.name === 'index'
			? 'src'
			: parsedPath.name === 'test' && directoryName.at(-1) !== 'test'
			? 'test'
			: '',
		parsedPath.base,
	);

	const data = await api.readFile(path);

	const commands: FileCommand[] = [
		{
			kind: 'upsertFile',
			path: newPath,
			options: {
				...options,
				data,
			},
		},
	];

	if (parsedPath.base === 'config.json') {
		const parsedData = JSON.parse(data);

		const { engine } = parsedData;

		state?.workspaces.add(
			api.joinPaths('codemods', ...directoryName.slice(0, -1), '*'),
		);

		const indexTsPath = format({
			root: parsedPath.dir,
			dir: parsedPath.dir,
			base: 'index.ts',
		});

		const indexTsDoesExists = api.exists(indexTsPath);

		{
			const packageJsonPath = api.joinPaths(
				api.currentWorkingDirectory,
				'codemods',
				...directoryName,
				'package.json',
			);

			const name = `@codemod-registry/${directoryName
				.join('-')
				.toLowerCase()
				.replace(/ /, '-')}`;

			commands.push({
				kind: 'upsertFile',
				path: packageJsonPath,
				options: {
					...options,
					name,
					engine,
					extension: indexTsDoesExists ? 'ts' : 'js',
				},
			});
		}

		if (engine !== 'recipe') {
			const tsconfigJsonPath = api.joinPaths(
				api.currentWorkingDirectory,
				'codemods',
				...directoryName,
				'tsconfig.json',
			);

			commands.push({
				kind: 'upsertFile',
				path: tsconfigJsonPath,
				options,
			});
		}

		{
			const mocharcPath = api.joinPaths(
				api.currentWorkingDirectory,
				'codemods',
				...directoryName,
				'.mocharc.json',
			);

			commands.push({
				kind: 'upsertFile',
				path: mocharcPath,
				options: {
					...options,
				},
			});
		}

		if (engine !== 'recipe' || engine !== 'piranha') {
			const indexDtsPath = api.joinPaths(
				api.currentWorkingDirectory,
				'codemods',
				...directoryName,
				'index.d.ts',
			);

			commands.push({
				kind: 'upsertFile',
				path: indexDtsPath,
				options: {
					...options,
					engine,
				},
			});
		}
	}

	return commands;
};

const handleData: HandleData<Dependencies, State> = async (
	_,
	path,
	__,
	options,
	state,
) => {
	if (state === null) {
		throw new Error('The state is not set');
	}

	if (state.step === 'UPSERTING_CODEMODS') {
		if (path.endsWith('package.json')) {
			const name =
				typeof options['name'] === 'string' ? options['name'] : null;

			const engine =
				typeof options['engine'] === 'string'
					? options['engine']
					: null;

			const extension =
				typeof options['extension'] === 'string'
					? options['extension']
					: null;

			if (name === null || engine === null || extension === null) {
				throw new Error(
					'Name and engine need to be defined for package.json',
				);
			}

			const devDependencies: Record<string, string> | undefined =
				engine !== 'piranha'
					? {
							'@codemod-registry/tsconfig': 'workspace:*',
							'@codemod-registry/utilities': 'workspace:*',
							'@codemod-registry/cjs-builder': 'workspace:*',
							typescript: '^5.2.2',
							esbuild: '0.19.5',
							mocha: '^10.2.0',
							'@types/mocha': '^10.0.4',
							'ts-node': '^10.9.1',
					  }
					: undefined;

			if (devDependencies !== undefined && engine === 'jscodeshift') {
				devDependencies['jscodeshift'] = '^0.15.1';
				devDependencies['@types/jscodeshift'] = '^0.11.10';
			} else if (devDependencies !== undefined && engine === 'ts-morph') {
				devDependencies['ts-morph'] = '^19.0.0';
			} else if (
				devDependencies !== undefined &&
				engine === 'repomod-engine'
			) {
				devDependencies['@intuita-inc/filemod'] = '1.1.0';
				// this might be required sometimes
				devDependencies['memfs'] = '^4.6.0';
				devDependencies['ts-morph'] = '^19.0.0';
				devDependencies['jscodeshift'] = '^0.15.1';
				devDependencies['@types/jscodeshift'] = '^0.11.10';
			}

			const main = engine !== 'piranha' ? './dist/index.cjs' : undefined;
			const types = engine !== 'piranha' ? '/dist/index.d.ts' : undefined;

			const scripts =
				engine !== 'piranha'
					? {
							'build:cjs': `cjs-builder ./src/index.${extension}`,
							test: 'mocha',
					  }
					: undefined;

			const files: string[] = ['README.md', 'config.json'];

			if (engine !== 'piranha') {
				files.push('./dist/index.cjs', './index.d.ts');
			}

			const data = JSON.stringify({
				name,
				devDependencies,
				main,
				types,
				scripts,
				files,
				type: 'module',
			});

			return {
				kind: 'upsertData',
				path,
				data,
			};
		}

		if (path.endsWith('index.d.ts')) {
			const engine =
				typeof options['engine'] === 'string'
					? options['engine']
					: null;

			if (engine === null) {
				throw new Error(
					'Name and engine need to be defined for package.json',
				);
			}

			const data =
				engine === 'jscodeshift'
					? [
							"import type { API, FileInfo } from 'jscodeshift';",
							'export default function transform(file: FileInfo, api: API): string;',
					  ].join('\n')
					: engine === 'ts-morph'
					? [
							"import type { SourceFile } from 'ts-morph';",
							'export function handleSourceFile(sourceFile: SourceFile): string | undefined;',
					  ].join('\n')
					: engine === 'repomod-engine'
					? [
							"import type { Filemod } from '@intuita-inc/filemod';",
							'export const repomod: Filemod<{}, {}>;',
					  ].join('\n')
					: '';

			return {
				kind: 'upsertData',
				path,
				data,
			};
		}

		if (path.endsWith('.mocharc.json')) {
			const data = JSON.stringify({
				loader: ['ts-node/esm'],
				'full-trace': true,
				bail: true,
				spec: './**/test.ts',
				timeout: 5000,
			});

			return {
				kind: 'upsertData',
				path,
				data,
			};
		}

		if (path.endsWith('tsconfig.json')) {
			const data = JSON.stringify({
				extends: '@codemod-registry/tsconfig',
				include: [
					'./src/**/*.ts',
					'./src/**/*.js',
					'./test/**/*.ts',
					'./test/**/*.js',
				],
			});

			return {
				kind: 'upsertData',
				path,
				data,
			};
		}

		if (typeof options['data'] === 'string') {
			return {
				kind: 'upsertData',
				path,
				data: options['data'],
			};
		}

		return { kind: 'noop' };
	}

	if (
		state.step === 'UPSERTING_WORKSPACES' &&
		path.endsWith('.pnpm-workspace.yml')
	) {
		const workspaces = Array.from(state.workspaces).sort();
		workspaces.unshift('builder');
		workspaces.unshift('utilities');
		workspaces.unshift('tsconfig');
		workspaces.unshift('cjs-builder');

		const data = [
			'packages:',
			...workspaces.map((workspace) => `\t- './${workspace}'`),
			'',
		].join('\n');

		return {
			kind: 'upsertData',
			path,
			data,
		};
	}

	return { kind: 'noop' };
};

const handleFinish: HandleFinish<State> = async (_, state) => {
	if (state === null) {
		throw new Error('The state is not set');
	}

	return {
		kind: state.step === 'UPSERTING_CODEMODS' ? 'restart' : 'noop',
	};
};

export const repomod: Filemod<Dependencies, State> = {
	includePatterns: ['**/*.{js,ts,json,md,toml}'],
	excludePatterns: ['**/node_modules/**', '**/build/**', '**/codemods/**'],
	initializeState,
	handleFile,
	handleData,
	handleFinish,
};
