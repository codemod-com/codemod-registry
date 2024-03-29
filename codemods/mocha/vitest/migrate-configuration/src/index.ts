import type { Filemod } from '@intuita-inc/filemod';
import {
	array,
	is,
	object,
	optional,
	record,
	string,
	type Input,
} from 'valibot';

const packageJsonSchema = object({
	name: optional(string()),
	dependencies: optional(record(string())),
	devDependencies: optional(record(string())),
	scripts: optional(record(string())),
	mocha: optional(record(string())),
});

const tsconfigSchema = object({
	compilerOptions: optional(object({ types: optional(array(string())) })),
	include: optional(array(string())),
});

export const repomod: Filemod<Record<string, never>, Record<string, never>> = {
	includePatterns: [
		'**/package.json',
		'**/tsconfig.json',
		'**/{,.}{mocharc,mocha.config}{,.js,.json,.cjs,.mjs,.yaml,.yml}',
		'**/.gitignore',
	],
	excludePatterns: ['**/node_modules/**'],
	handleFile: async (_, path, options) => {
		if (
			path.endsWith('tsconfig.json') ||
			path.endsWith('package.json') ||
			path.endsWith('.gitignore')
		) {
			return [{ kind: 'upsertFile', path, options }];
		}

		if (path.includes('mocha')) {
			return [{ kind: 'deleteFile', path }];
		}

		return [];
	},
	handleData: async (_, path, data) => {
		if (path.endsWith('package.json')) {
			let packageJson: Input<typeof packageJsonSchema>;
			try {
				const json = JSON.parse(data);
				if (!is(packageJsonSchema, json)) {
					return { kind: 'noop' };
				}
				packageJson = json;
			} catch (err) {
				return { kind: 'noop' };
			}

			// Remove possible "mocha" key and its value
			if (packageJson.mocha) {
				delete packageJson.mocha;
			}

			let mochaDepExists = false;
			// Remove mocha and other mocha-compatibles from dependencies & devDependencies, add vitest devDep
			if (packageJson.dependencies?.mocha) {
				Object.keys(packageJson.dependencies).forEach((dep) => {
					if (dep.includes('mocha')) {
						delete packageJson.dependencies![dep];
					}
				});

				mochaDepExists = true;
			}

			if (packageJson.devDependencies?.mocha) {
				Object.keys(packageJson.devDependencies).forEach((dep) => {
					if (dep.includes('mocha')) {
						delete packageJson.devDependencies![dep];
					}
				});

				mochaDepExists = true;
			}

			let mochaScriptExists = false;

			// Remove commands using mocha
			if (packageJson.scripts) {
				Object.entries(packageJson.scripts).forEach(
					([name, script]) => {
						if (script.includes('mocha')) {
							mochaScriptExists = true;
							delete packageJson.scripts![name];
						}
					},
				);

				// Add vitest commands if current package.json contained any mocha ones
				if (mochaScriptExists) {
					packageJson.scripts = {
						...packageJson.scripts,
						test: 'vitest run',
						'test:watch': 'vitest watch',
						coverage: 'vitest run --coverage',
					};
				}
			}

			if (mochaDepExists || mochaScriptExists) {
				packageJson.devDependencies = {
					...packageJson.devDependencies,
					vitest: '^1.0.1',
					'@vitest/coverage-v8': '^1.0.1',
				};
			}

			return {
				kind: 'upsertData',
				path,
				data: JSON.stringify(packageJson, null, 2),
			};
		}

		if (path.endsWith('tsconfig.json')) {
			let tsconfigJson: Input<typeof tsconfigSchema>;
			try {
				const json = JSON.parse(data);
				if (!is(tsconfigSchema, json)) {
					return { kind: 'noop' };
				}
				tsconfigJson = json;
			} catch (err) {
				return { kind: 'noop' };
			}

			// Remove possible `types: ['mocha']`
			if (tsconfigJson.compilerOptions?.types) {
				const newTypes = tsconfigJson.compilerOptions.types.filter(
					(type) => type !== 'mocha',
				);

				if (newTypes.length) {
					tsconfigJson.compilerOptions.types = newTypes;
				} else {
					delete tsconfigJson.compilerOptions.types;
				}
			}
			if (tsconfigJson.include) {
				const newIncludes = tsconfigJson.include.filter(
					(type) => type !== 'mocha',
				);

				if (newIncludes.length) {
					tsconfigJson.include = newIncludes;
				} else {
					delete tsconfigJson.include;
				}
			}

			return {
				kind: 'upsertData',
				path,
				data: JSON.stringify(tsconfigJson, null, 2),
			};
		}

		if (path.endsWith('.gitignore')) {
			const expressions = data.split('\n');

			if (
				expressions.some((expression) =>
					expression.trimEnd().endsWith('coverage'),
				)
			) {
				return { kind: 'noop' };
			}

			expressions.push('coverage');

			return {
				kind: 'upsertData',
				path,
				data: expressions.join('\n'),
			};
		}

		return { kind: 'noop' };
	},
};
