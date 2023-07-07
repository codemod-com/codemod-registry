import { join } from 'path';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from 'fs';
import { createHash } from 'crypto';
import * as S from '@effect/schema/Schema';

const CodemodSchema = S.struct({
	kind: S.literal('piranhaRule'),
	hashDigest: S.string,
	name: S.string,
	language: S.string,
	configurationDirectoryBasename: S.string,
	rulesTomlFileBasename: S.string,
});

type Codemod = S.To<typeof CodemodSchema>;

const CodemodConfigSchema = S.struct({
	name: S.string,
	engine: S.literal('piranha'),
	language: S.literal('java'),
});

type CodemodConfig = S.To<typeof CodemodConfigSchema>;

const buildCodemod = (config: CodemodConfig): Codemod => {
	const hashDigest = createHash('ripemd160')
		.update(config.name)
		.digest('base64url');

	const configurationDirectoryBasename = createHash('ripemd160')
		.update('configuration')
		.update(config.name)
		.digest('base64url');

	const hash = createHash('ripemd160')
		.update('rules.toml')
		.update(config.name)
		.digest('base64url');

	const rulesTomlFileBasename = `${hash}.toml`;

	return {
		kind: 'piranhaRule',
		hashDigest,
		name: config.name,
		language: config.language,
		configurationDirectoryBasename,
		rulesTomlFileBasename,
	};
};

type Entry = Readonly<{
	kind: 'README' | 'rules.toml';
	name: string;
	path: string;
}>;

const entries: Entry[] = [];
const codemods: Codemod[] = [];

const buildDirectoryPath = join(__dirname, './build');

mkdirSync(buildDirectoryPath, { recursive: true });

const handleDirectory = (rootDirectory: string) => {
	const directories = readdirSync(rootDirectory);

	for (const directory of directories) {
		const configPath = join(rootDirectory, directory, 'config.json');
		const readmePath = join(rootDirectory, directory, 'README.md');
		const rulesPath = join(rootDirectory, directory, 'rules.toml');

		const config = readFileSync(configPath, 'utf8');
		const jsonConfig = JSON.parse(config);

		if (existsSync(readmePath)) {
			const data = readFileSync(readmePath, 'utf8');

			const hashDigest = createHash('ripemd160')
				.update('README.md')
				.update(jsonConfig.name)
				.digest('base64url');

			const path = join(buildDirectoryPath, `${hashDigest}.md`);

			entries.push({
				kind: 'README',
				name: jsonConfig.name,
				path: `${hashDigest}.md`,
			});

			writeFileSync(path, data);
		}

		const parseCodemodConfigSchema = S.parseEither(CodemodConfigSchema);

		const codemodConfig = parseCodemodConfigSchema(jsonConfig);

		if (existsSync(rulesPath) && codemodConfig._tag === 'Right') {
			const data = readFileSync(rulesPath, 'utf8');

			const codemod = buildCodemod(codemodConfig.right);

			const path = join(
				buildDirectoryPath,
				codemod.rulesTomlFileBasename,
			);

			writeFileSync(path, data);

			codemods.push(codemod);
		}
	}
};

handleDirectory(join(__dirname, './codemods/jscodeshift/next/13'));
handleDirectory(join(__dirname, './codemods/repomod-engine/next/13'));
handleDirectory(join(__dirname, './codemods/ts-morph/next/13'));
handleDirectory(join(__dirname, './codemods/piranha'));

writeFileSync(join(buildDirectoryPath, 'index.json'), JSON.stringify(entries));
writeFileSync(
	join(buildDirectoryPath, 'codemods.json'),
	JSON.stringify(codemods),
);
