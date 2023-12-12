import type { Filemod } from '@intuita-inc/filemod';
import {
	string,
	record,
	object,
	optional,
	type Input,
	parse,
	array,
} from 'valibot';

const packageJsonSchema = object({
	name: optional(string()),
	dependencies: optional(record(string())),
	devDependencies: optional(record(string())),
	scripts: optional(record(string())),
	mocha: optional(record(string())),
});

const tsconfigSchema = object({
	include: optional(array(string())),
	compilerOptions: optional(object({ types: optional(array(string())) })),
});

export const repomod: Filemod<Record<string, never>, Record<string, never>> = {
	includePatterns: [
		'**/package.json',
		'**/tsconfig.json',
		'**/{,.}{mocharc,mocha.config}{,.js,.json,.cjs,.mjs,.yaml,.yml}',
	],
	excludePatterns: ['**/node_modules/**'],
	handleFile: async (_, path, options) => {
		if (path.endsWith('tsconfig.json') || path.endsWith('package.json')) {
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
				packageJson = parse(packageJsonSchema, json);
			} catch (err) {
				return { kind: 'noop' };
			}

			// Remove possible "mocha" key and its value
			if (packageJson.mocha) {
				delete packageJson.mocha;
			}

			// Remove mocha from dependencies & devDependencies, add vitest devDep
			if (packageJson.dependencies) {
				Object.keys(packageJson.dependencies).forEach((dep) => {
					delete packageJson.dependencies![dep];
				});
			}
			if (packageJson.devDependencies) {
				Object.keys(packageJson.devDependencies).forEach((dep) => {
					delete packageJson.devDependencies![dep];
				});
			}
			packageJson.devDependencies = {
				...packageJson.devDependencies,
				vitest: '^1.0.1',
				'@vitest/coverage-v8': '^1.0.1',
			};

			// Remove commands using mocha
			if (packageJson.scripts) {
				Object.entries(
					packageJson.scripts as Record<string, string>,
				).forEach(([name, script]) => {
					if (script.includes('mocha')) {
						delete packageJson.scripts![name];
					}
				});
			}

			// Add vitest commands
			if (packageJson.scripts) {
				packageJson.scripts = {
					...packageJson.scripts,
					test: 'vitest run',
					coverage: 'vitest run --coverage',
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
				tsconfigJson = parse(tsconfigSchema, json);
			} catch (err) {
				return { kind: 'noop' };
			}

			// Remove possible `types: ['mocha']`
			if (tsconfigJson.compilerOptions?.types) {
				const newTypes = tsconfigJson.compilerOptions.types.filter(
					(type: string) => type !== 'mocha',
				);

				if (newTypes.length) {
					tsconfigJson.compilerOptions.types = newTypes;
				} else {
					delete tsconfigJson.compilerOptions.types;
				}
			}
			if (tsconfigJson.include) {
				const newIncludes = tsconfigJson.include.filter(
					(type: string) => type !== 'mocha',
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

		return { kind: 'noop' };
	},
};
