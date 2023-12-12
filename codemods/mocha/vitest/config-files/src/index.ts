import type { Filemod } from '@intuita-inc/filemod';

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

		// mocharc
		return [{ kind: 'deleteFile', path }];
	},
	handleData: async (_, path, data) => {
		if (path.endsWith('package.json')) {
			const json = JSON.parse(data);
			// Remove possible "mocha" key and its value
			if (json.mocha) {
				delete json.mocha;
			}

			// Remove mocha from dependencies & devDependencies, add vitest devDep
			if (json.dependencies) {
				Object.keys(json.dependencies).forEach((dep) => {
					delete json.dependencies[dep];
				});
			}
			if (json.devDependencies) {
				Object.keys(json.devDependencies).forEach((dep) => {
					delete json.devDependencies[dep];
				});
			}
			json.devDependencies = {
				...json.devDependencies,
				vitest: '^1.0.1',
				'@vitest/coverage-v8': '^1.0.1',
			};

			// Remove commands using mocha
			if (json.scripts) {
				Object.entries(json.scripts as Record<string, string>).forEach(
					([name, script]) => {
						if (script.includes('mocha')) {
							delete json.scripts[name];
						}
					},
				);
			}

			// Add vitest commands
			if (json.scripts) {
				json.scripts = {
					...json.scripts,
					test: 'vitest run',
					coverage: 'vitest run --coverage',
				};
			}

			return {
				kind: 'upsertData',
				path,
				data: JSON.stringify(json, null, 2),
			};
		}

		if (path.endsWith('tsconfig.json')) {
			// Remove possible `types: ['mocha']`
			const json = JSON.parse(data);

			if (json.compilerOptions?.types) {
				const newTypes = json.compilerOptions.types.filter(
					(type: string) => type !== 'mocha',
				);

				if (newTypes.length) {
					json.compilerOptions.types = newTypes;
				} else {
					delete json.compilerOptions.types;
				}
			}

			return {
				kind: 'upsertData',
				path,
				data: JSON.stringify(json, null, 2),
			};
		}

		return { kind: 'noop' };
	},
};
