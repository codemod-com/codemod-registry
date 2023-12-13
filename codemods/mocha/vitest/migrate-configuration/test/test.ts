import {
	FileSystemManager,
	UnifiedFileSystem,
	buildApi,
	executeFilemod,
} from '@intuita-inc/filemod';
import { DirectoryJSON, Volume, createFsFromVolume } from 'memfs';
import { Context } from 'mocha';
import { deepEqual, equal, ok } from 'node:assert';
import { repomod } from '../src/index.js';

const transform = async (json: DirectoryJSON) => {
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

	const api = buildApi(unifiedFileSystem, () => ({}), '/');

	return executeFilemod(api, repomod, '/', {}, {});
};

describe('mocha config-files', function () {
	const packageJsonPath = '/opt/project/package.json';
	const packageJsonConfig = `
    {
      "name": "package-name",
      "dependencies": {
        "mocha": "^10.2.0",
        "some-mocha-plugin": "^10.0.4"
      },
      "devDependencies": {
        "mocha": "^10.2.0",
        "@types/mocha": "^10.0.4"
      },
      "main": "./dist/index.cjs",
      "types": "/dist/index.d.ts",
      "scripts": {
        "build:cjs": "cjs-builder ./src/index.ts",
        "test": "mocha"
      },
      "mocha": {
        "config-key": "config-value"
      },
      "files": [
        "README.md",
        "config.json",
        "./dist/index.cjs",
        "./index.d.ts"
      ],
      "type": "module"
    }
  `;

	const tsconfigPath = '/opt/project/tsconfig.json';
	const tsconfigContent = `
    {
      "compilerOptions": { "types": ["mocha"] },
      "include": [
        "./src/**/*.ts",
        "./src/**/*.js",
        "./test/**/*.ts",
        "./test/**/*.js"
      ]
    }
  `;

	const mochaRcPath = '/opt/project/.mocharc';
	const mochaRcCjsPath = '/opt/project/.mocharc.cjs';
	const mochaConfigPath = '/opt/project/mocha.config.mjs';
	const mochaRcContent = `
    {
      "loader": ["ts-node/esm"],
      "full-trace": true,
      "failZero": false,
      "bail": true,
      "spec": "./**/test.ts",
      "timeout": 5000
    }
  `;

	const gitIgnorePath = '/opt/project/.gitignore';
	const gitIgnoreContent = `
    build
    dist
    node_modules
  `;

	it('should contain correct file commands', async function (this: Context) {
		const externalFileCommands = await transform({
			[packageJsonPath]: packageJsonConfig,
			[tsconfigPath]: tsconfigContent,
			[mochaRcPath]: mochaRcContent,
			[mochaRcCjsPath]: mochaRcContent,
			[mochaConfigPath]: mochaRcContent,
			[gitIgnorePath]: gitIgnoreContent,
		});

		deepEqual(externalFileCommands.length, 6);

		ok(
			externalFileCommands.filter(
				(command) =>
					(command.kind === 'upsertFile' &&
						command.path === packageJsonPath) ||
					(command.kind === 'upsertFile' &&
						command.path === tsconfigPath) ||
					(command.kind === 'deleteFile' &&
						command.path === mochaRcPath) ||
					(command.kind === 'deleteFile' &&
						command.path === mochaRcCjsPath) ||
					(command.kind === 'deleteFile' &&
						command.path === mochaConfigPath) ||
					(command.kind === 'upsertFile' &&
						command.path === gitIgnorePath),
			).length === externalFileCommands.length,
		);
	});

	it('should correctly modify package and tsconfig jsons', async function (this: Context) {
		const externalFileCommands = await transform({
			[packageJsonPath]: packageJsonConfig,
			[tsconfigPath]: tsconfigContent,
			[mochaRcPath]: mochaRcContent,
			[mochaRcCjsPath]: mochaRcContent,
			[mochaConfigPath]: mochaRcContent,
		});

		ok(
			externalFileCommands.some(
				(command) =>
					command.kind === 'upsertFile' &&
					command.path === packageJsonPath &&
					command.data.replace(/\W/gm, '') ===
						`
              {
                "name": "package-name",
                "dependencies": {},
                "devDependencies": {
                  "vitest": "^1.0.1",
                  "@vitest/coverage-v8": "^1.0.1"
                },
                "main": "./dist/index.cjs",
                "types": "/dist/index.d.ts",
                "scripts": {
                  "build:cjs": "cjs-builder ./src/index.ts",
                  "test": "vitest run",
                  "coverage": "vitest run --coverage"
                },
                "files": [
                  "README.md",
                  "config.json",
                  "./dist/index.cjs",
                  "./index.d.ts"
                ],
                "type": "module"
              }
            `.replace(/\W/gm, ''),
			),
		);

		ok(
			externalFileCommands.some(
				(command) =>
					command.kind === 'upsertFile' &&
					command.path === tsconfigPath &&
					command.data.replace(/\W/gm, '') ===
						`
              {
                "compilerOptions": {},
                "include": [
                  "./src/**/*.ts",
                  "./src/**/*.js",
                  "./test/**/*.ts",
                  "./test/**/*.js"
                ]
              }
            `.replace(/\W/gm, ''),
			),
		);
	});

	it('should correctly transform the .gitignore file', async function (this: Context) {
		const externalFileCommands = await transform({
			[gitIgnorePath]: gitIgnoreContent,
		});

		equal(externalFileCommands.length, 1);

		ok(
			externalFileCommands.some(
				(command) =>
					command.kind === 'upsertFile' &&
					command.path === gitIgnorePath &&
					command.data.replace(/\W/gm, '') ===
						`
            build
            dist
            node_modules
            coverage
            `.replace(/\W/gm, ''),
			),
		);
	});
});
