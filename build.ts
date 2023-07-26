import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	access,
	copyFile,
	mkdir,
	readFile,
	readdir,
	rmdir,
	stat,
	unlink,
	writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { globSync } from 'glob';
import esbuild from 'esbuild';
import * as S from '@effect/schema/Schema';
import { constants } from 'node:fs';
import { deflate } from 'node:zlib';
import { promisify } from 'node:util';
import * as tar from 'tar';

const promisifiedDeflate = promisify(deflate);

const codemodConfigSchema = S.union(
	S.struct({
		schemaVersion: S.literal('1.0.0'),
		engine: S.literal('piranha'),
		language: S.literal('java'),
	}),
	S.struct({
		schemaVersion: S.literal('1.0.0'),
		engine: S.literal('jscodeshift'),
	}),
	S.struct({
		schemaVersion: S.literal('1.0.0'),
		engine: S.literal('ts-morph'),
	}),
	S.struct({
		schemaVersion: S.literal('1.0.0'),
		engine: S.literal('repomod-engine'),
	}),
	S.struct({
		schemaVersion: S.literal('1.0.0'),
		engine: S.literal('recipe'),
		names: S.array(S.string),
	}),
);

const parseCodemodConfigSchema = S.parseSync(codemodConfigSchema);

const transpile = async (
	input: Buffer,
	extension: 'js' | 'ts',
): Promise<Buffer> => {
	const options: Parameters<typeof esbuild.transform>[1] = {
		legalComments: 'inline',
		minifyWhitespace: true,
		format: 'cjs',
	};

	if (extension === 'ts') {
		options.loader = 'ts';
	}

	const { code } = await esbuild.transform(input, options);

	return Buffer.from(code, 'utf8');
};

const removeDirectoryContents = async (directoryPath: string) => {
	const paths = await readdir(directoryPath);

	// Loop through the files and delete them
	for (const path of paths) {
		const absolutePath = join(directoryPath, path);

		const stats = await stat(absolutePath);

		if (!stats.isFile()) {
			await removeDirectoryContents(absolutePath);

			await rmdir(absolutePath);

			continue;
		}

		await unlink(absolutePath);
	}
};

const build = async () => {
	const cwd = fileURLToPath(new URL('.', import.meta.url));

	const configFilePaths = globSync('**/config.json', {
		cwd,
		dot: false,
		ignore: ['**/node_modules/**', '**/build/**'],
	});

	const names = configFilePaths.map(dirname);

	// emitting names

	const buildDirectoryPath = join(cwd, './build');

	await mkdir(buildDirectoryPath, { recursive: true });

	await removeDirectoryContents(buildDirectoryPath);

	await writeFile(
		join(buildDirectoryPath, 'names.json'),
		JSON.stringify(names),
	);

	for (const name of names) {
		const hashDigest = createHash('ripemd160')
			.update(name)
			.digest('base64url');

		const codemodDirectoryPath = join(buildDirectoryPath, hashDigest);

		await mkdir(codemodDirectoryPath, { recursive: true });

		const configPath = join(cwd, name, 'config.json');

		const data = await readFile(configPath, { encoding: 'utf8' });

		const config = parseCodemodConfigSchema(JSON.parse(data), {
			onExcessProperty: 'ignore',
		});

		{
			const buildConfigPath = join(codemodDirectoryPath, 'config.json');

			writeFile(buildConfigPath, JSON.stringify(config));
		}

		if (
			config.engine === 'jscodeshift' ||
			config.engine === 'ts-morph' ||
			config.engine === 'repomod-engine'
		) {
			try {
				const indexPath = join(cwd, name, 'index.ts');

				await access(indexPath, constants.R_OK);

				const data = await readFile(indexPath);
				const code = await transpile(data, 'ts');
				const compressedBuffer = await promisifiedDeflate(code);

				const buildIndexPath = join(
					codemodDirectoryPath,
					'index.cjs.z',
				);

				writeFile(buildIndexPath, compressedBuffer);
			} catch (error) {
				console.error(error);
			}

			try {
				const indexPath = join(cwd, name, 'index.js');

				await access(indexPath, constants.R_OK);

				const data = await readFile(indexPath);
				const code = await transpile(data, 'js');
				const compressedBuffer = await promisifiedDeflate(code);

				const buildIndexPath = join(
					codemodDirectoryPath,
					'index.cjs.z',
				);

				writeFile(buildIndexPath, compressedBuffer);
			} catch (error) {
				console.error(error);
			}
		} else if (config.engine === 'piranha') {
			const rulesPath = join(cwd, name, 'rules.toml');
			const buildRulesPath = join(codemodDirectoryPath, 'rules.toml');

			await copyFile(rulesPath, buildRulesPath);
		} else if (config.engine === 'recipe') {
			// nothing to do
		}

		try {
			const readmePath = join(cwd, name, 'README.md');
			const buildDescriptionPath = join(
				codemodDirectoryPath,
				'description.md',
			);

			await access(readmePath, constants.R_OK);

			await copyFile(readmePath, buildDescriptionPath);
		} catch {}
	}

	await tar.create(
		{
			cwd: buildDirectoryPath,
			portable: true,
			file: join(buildDirectoryPath, 'registry.tar.gz'),
			gzip: true,
		},
		await readdir(buildDirectoryPath),
	);
};

await build();
