import type {
	Filemod,
	HandleData,
	HandleFile,
	HandleFinish,
	InitializeState,
} from '@intuita-inc/filemod';
import { posix } from 'node:path';
import type { JSCodeshift } from 'jscodeshift';
import type { TSAsExpressionKind } from 'ast-types/gen/kinds.js';

type Dependencies = { jscodeshift: JSCodeshift };

type Entry = Readonly<{
	pathname: string;
	envVar: string;
}>;

type State = {
	step: 'READING' | 'UPSERTING';
	turboPath: string;
	middlewarePath: string;
	entries: Set<Entry>;
};

const initializeState: InitializeState<State> = async (
	options,
	previousState,
) => {
	if (previousState !== null) {
		return {
			...previousState,
			step: 'UPSERTING',
		};
	}

	const { turboPath, middlewarePath } = options;

	if (typeof turboPath !== 'string') {
		throw new Error('The turbo.json absolute path has not been defined');
	}

	if (typeof middlewarePath !== 'string') {
		throw new Error('The middleware.ts absolute path has not been defined');
	}

	return {
		step: 'READING',
		turboPath,
		middlewarePath,
		entries: new Set(),
	};
};

const COMMON_PART_REGEX = /^(?<cpart>[a-zA-Z0-9-_]+)$/;
const DYNAMIC_SEGMENT_PART_REGEX = /^\[(?<dspart>[a-zA-Z0-9-_]+)\]$/;
const CATCH_ALL_DYNAMIC_SEGMENT_PART_REGEX =
	/^\[\.{3}(?<cadspart>[a-zA-Z0-9-_]+)\]$/;
const OPTIONAL_CATCH_ALL_DYNAMIC_SEGMENT_PART_REGEX =
	/^\[{2}\.{3}(?<ocadspart>[a-zA-Z0-9-_]+)\]{2}$/;

const isNeitherNullNorUndefined = <T>(
	t: NonNullable<T> | null | undefined,
): t is NonNullable<T> => t !== null && t !== undefined;

const getRegexGroups = (part: string) => {
	const regExpExecArray =
		COMMON_PART_REGEX.exec(part) ??
		DYNAMIC_SEGMENT_PART_REGEX.exec(part) ??
		CATCH_ALL_DYNAMIC_SEGMENT_PART_REGEX.exec(part) ??
		OPTIONAL_CATCH_ALL_DYNAMIC_SEGMENT_PART_REGEX.exec(part);

	return regExpExecArray?.groups ?? {};
};

const handleFile: HandleFile<Dependencies, State> = async (
	_,
	path,
	options,
	state,
) => {
	if (state === null) {
		throw new Error('The state is not set');
	}

	if (state.step === 'READING') {
		const parsedPath = posix.parse(path);
		const directoryNames = parsedPath.dir.split(posix.sep);

		if (!directoryNames.includes('app') || parsedPath.name !== 'page') {
			return [];
		}

		const parts = directoryNames
			.slice(directoryNames.lastIndexOf('app') + 1)
			.filter((part) => part !== 'future');

		if (parts.length === 0) {
			return [];
		}

		const pathname = parts
			.map((part) => {
				const { cpart, dspart, cadspart, ocadspart } =
					getRegexGroups(part);

				if (cpart !== undefined) {
					return cpart;
				}

				if (dspart !== undefined) {
					return `:${dspart}`;
				}

				if (cadspart !== undefined) {
					return `:${cadspart}+`;
				}

				if (ocadspart !== undefined) {
					return `:${ocadspart}*`;
				}

				return null;
			})
			.filter(isNeitherNullNorUndefined)
			.map((part) => `/${part}`)
			.join('');

		const partialEnvVar = parts
			.map((part) => {
				const { cpart, dspart, cadspart, ocadspart } =
					getRegexGroups(part);

				const somePart =
					cpart ?? dspart ?? cadspart ?? ocadspart ?? null;

				return somePart?.replace(/-/g, '_').toUpperCase() ?? null;
			})
			.filter(isNeitherNullNorUndefined)
			.join('_');

		const envVar = ['APP_ROUTER', partialEnvVar, 'ENABLED'].join('_');

		state.entries.add({
			pathname,
			envVar,
		});

		return [];
	}

	if (path === state.turboPath || path === state.middlewarePath) {
		return [
			{
				kind: 'upsertFile',
				path,
				options,
			},
		];
	}

	return [];
};

const handleData: HandleData<Dependencies, State> = async (
	api,
	path,
	data,
	_,
	state,
) => {
	if (state === null) {
		throw new Error('The state is not set');
	}

	if (path === state.turboPath) {
		const json = JSON.parse(data);

		const globalEnv = new Set<string>(json.globalEnv);

		for (const { envVar } of state.entries) {
			globalEnv.add(envVar);
		}

		const newData = JSON.stringify({
			...json,
			globalEnv: Array.from(globalEnv).sort(),
		});

		return {
			kind: 'upsertData',
			path,
			data: newData,
		};
	}

	if (path === state.middlewarePath) {
		const { jscodeshift } = api.getDependencies();
		const { VariableDeclarator, Program } = jscodeshift;
		const root = jscodeshift.withParser('tsx')(data);

		const buildElement = (entry: Entry): TSAsExpressionKind => {
			return {
				type: 'TSAsExpression',
				expression: {
					type: 'ArrayExpression',
					elements: [
						{
							type: 'StringLiteral',
							value: entry.pathname,
						},
						{
							type: 'CallExpression',
							callee: {
								type: 'Identifier',
								name: 'Boolean',
							},
							arguments: [
								{
									type: 'MemberExpression',
									object: {
										type: 'MemberExpression',
										object: {
											type: 'Identifier',
											name: 'process',
										},
										property: {
											type: 'Identifier',
											name: 'env',
										},
									},
									property: {
										type: 'Identifier',
										name: entry.envVar,
									},
								},
							],
						},
					],
				},
				typeAnnotation: {
					type: 'TSTypeReference',
					typeName: {
						type: 'Identifier',
						name: 'const',
					},
				},
			};
		};

		const elements = Array.from(state.entries)
			.sort((a, b) => a.pathname.localeCompare(b.pathname))
			.map((entry) => buildElement(entry));

		const variableDeclarator = jscodeshift.variableDeclarator(
			{
				type: 'Identifier',
				name: 'ROUTES',
				typeAnnotation: {
					type: 'TSTypeAnnotation',
					typeAnnotation: {
						type: 'TSArrayType',
						elementType: {
							type: 'TSTupleType',
							elementTypes: [
								{
									type: 'TSTypeReference',
									typeName: {
										type: 'Identifier',
										name: 'URLPattern',
									},
								},
								{
									type: 'TSBooleanKeyword',
								},
							],
						},
					},
				},
			},
			{
				type: 'CallExpression',
				callee: {
					type: 'MemberExpression',
					object: {
						type: 'ArrayExpression',
						elements,
					},
					property: {
						type: 'Identifier',
						name: 'map',
					},
				},
				arguments: [
					{
						type: 'ArrowFunctionExpression',
						params: [
							{
								type: 'ArrayPattern',
								elements: [
									{
										type: 'Identifier',
										name: 'pathname',
									},
									{
										type: 'Identifier',
										name: 'enabled',
									},
								],
							},
						],
						body: {
							type: 'ArrayExpression',
							elements: [
								{
									type: 'NewExpression',
									callee: {
										type: 'Identifier',
										name: 'URLPattern',
									},
									arguments: [
										{
											type: 'ObjectExpression',
											properties: [
												{
													type: 'ObjectProperty',
													key: {
														type: 'Identifier',
														name: 'pathname',
													},
													value: {
														type: 'Identifier',
														name: 'pathname',
													},
													shorthand: true,
												},
											],
										},
									],
								},
								{
									type: 'Identifier',
									name: 'enabled',
								},
							],
						},
					},
				],
			},
		);

		const routesVariableDeclarators = root.find(VariableDeclarator, {
			type: 'VariableDeclarator',
			id: {
				type: 'Identifier',
				name: 'ROUTES',
			},
		});

		if (routesVariableDeclarators.length === 0) {
			const variableDeclation = jscodeshift.variableDeclaration('const', [
				variableDeclarator,
			]);

			root.find(Program).nodes()[0]?.body.push(variableDeclation);
		} else {
			routesVariableDeclarators.replaceWith(() => variableDeclarator);
		}

		const source = root.toSource();

		return { kind: 'upsertData', path, data: source };
	}

	return { kind: 'noop' };
};

const handleFinish: HandleFinish<State> = async (_, state) => {
	if (state === null) {
		throw new Error('The state is not set');
	}

	return {
		kind: state.step === 'READING' ? 'restart' : 'noop',
	};
};

export const repomod: Filemod<Dependencies, State> = {
	includePatterns: ['**/*.{js,jsx,ts,tsx,json}'],
	excludePatterns: ['**/node_modules/**', '**/pages/api/**'],
	initializeState,
	handleFile,
	handleData,
	handleFinish,
};
