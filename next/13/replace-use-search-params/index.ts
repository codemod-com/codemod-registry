import {
	CallExpression,
	Collection,
	File,
	ImportDeclaration,
	JSCodeshift,
} from 'jscodeshift';
import jscodeshift from 'jscodeshift';

import type { HandleFile, Repomod } from '@intuita-inc/repomod-engine-api';

type Settings = {
	useCompatSearchParamsHookAbsolutePath: string;
	useCompatSearchParamsHookModuleSpecifier: string;
};

type ModFunction<T, D extends 'read' | 'write'> = (
	j: JSCodeshift,
	root: Collection<T>,
	settings: Settings,
) => [D extends 'write' ? boolean : false, ReadonlyArray<LazyModFunction>];

type LazyModFunction = [
	ModFunction<any, 'read' | 'write'>,
	Collection<any>,
	Settings,
];

type Dependencies = {
	jscodeshift: typeof jscodeshift;
};

type State = {
	useCompatSearchParamsHookCreated: boolean;
};

type FileCommand = Awaited<ReturnType<HandleFile<Dependencies, State>>>[number];

export const USE_COMPAT_SEARCH_PARAMS_HOOK_CONTENT = `
import {  useParams, useSearchParams } from "next/navigation"

  export const useCompatSearchParams = () => {
    const _searchParams = useSearchParams();
    const params = useParams() ?? {};
  
    const map = new Map<string, string[] | string>(_searchParams);
  
    Object.getOwnPropertyNames(params).forEach((key) => {
      map.set(key, params[key]);
    });
  
    return map;
  };
`;

const replaceCallExpression: ModFunction<CallExpression, 'write'> = (
	j,
	callExpression,
) => {
	callExpression.replaceWith(
		j.callExpression(j.identifier('useCompatSearchParams'), []),
	);

	return [true, []];
};

const findCallExpressions: ModFunction<File, 'read'> = (j, root, settings) => {
	const lazyModFunctions: LazyModFunction[] = [];

	root.find(j.CallExpression, {
		callee: {
			type: 'Identifier',
			name: 'useSearchParams',
		},
	}).forEach((callExpressionPath) => {
		lazyModFunctions.push([
			replaceCallExpression,
			j(callExpressionPath),
			settings,
		]);
	});

	return [false, lazyModFunctions];
};

const addImportDeclaration: ModFunction<File, 'write'> = (
	j,
	root,
	{ useCompatSearchParamsHookModuleSpecifier },
) => {
	root.find(j.Program).forEach((programPath) => {
		programPath.value.body.unshift(
			j.importDeclaration(
				[j.importSpecifier(j.identifier('useCompatSearchParams'))],
				j.literal(useCompatSearchParamsHookModuleSpecifier),
			),
		);
	});

	return [false, []];
};

const replaceImportDeclaration: ModFunction<ImportDeclaration, 'write'> = (
	j,
	importDeclaration,
) => {
	let shouldBeRemoved = false;
	importDeclaration.forEach((importDeclarationPath) => {
		importDeclarationPath.value.specifiers =
			importDeclarationPath.value.specifiers?.filter((specifier) => {
				return (
					!j.ImportSpecifier.check(specifier) ||
					specifier.imported.name !== 'useSearchParams'
				);
			});

		if (importDeclarationPath.value.specifiers?.length === 0) {
			shouldBeRemoved = true;
		}
	});

	if (shouldBeRemoved) {
		importDeclaration.remove();
	}

	return [true, []];
};

const findImportDeclaration: ModFunction<File, 'read'> = (
	j,
	root,
	settings,
) => {
	const lazyModFunctions: LazyModFunction[] = [];

	root.find(j.ImportDeclaration, {
		source: {
			value: 'next/navigation',
		},
	}).forEach((importDeclarationPath) => {
		lazyModFunctions.push([
			replaceImportDeclaration,
			j(importDeclarationPath),
			settings,
		]);
	});

	return [false, lazyModFunctions];
};

export default function transform(
	jscodeshift: JSCodeshift,
	data: string,
	settings: Settings,
): string | undefined {
	let dirtyFlag = false;
	const j = jscodeshift.withParser('tsx');
	const root = j(data);

	const lazyModFunctions: LazyModFunction[] = [
		[findCallExpressions, root, settings],
	];

	const handleLazyModFunction = (lazyModFunction: LazyModFunction) => {
		const [modFunction, localCollection, localSettings] = lazyModFunction;

		const [localDirtyFlag, localLazyModFunctions] = modFunction(
			j,
			localCollection,
			localSettings,
		);

		dirtyFlag ||= localDirtyFlag;

		for (const localLazyModFunction of localLazyModFunctions) {
			handleLazyModFunction(localLazyModFunction);
		}
	};

	for (const lazyModFunction of lazyModFunctions) {
		handleLazyModFunction(lazyModFunction);
	}

	if (!dirtyFlag) {
		return undefined;
	}

	handleLazyModFunction([findImportDeclaration, root, settings]);
	handleLazyModFunction([addImportDeclaration, root, settings]);

	return root.toSource();
}

const noop = {
	kind: 'noop',
} as const;

export const repomod: Repomod<Dependencies, State> = {
	includePatterns: ['**/*.{jsx,tsx,js,ts,cjs,ejs}'],
	excludePatterns: ['**/node_modules/**', '**/pages/api/**'],
	initializeState: async (_, previousState) => {
		return (
			previousState ?? {
				useCompatSearchParamsHookCreated: false,
			}
		);
	},
	handleFile: async (_, path, options, state) => {
		const commands: FileCommand[] = [];

		if (typeof options.useCompatSearchParamsHookAbsolutePath !== 'string') {
			throw new Error(
				'Missing useCompatSearchParamsHookAbsolutePath option',
			);
		}

		if (state !== null && !state.useCompatSearchParamsHookCreated) {
			commands.push({
				kind: 'upsertFile',
				path: options.useCompatSearchParamsHookAbsolutePath,
				options: {
					...options,
					fileContent: USE_COMPAT_SEARCH_PARAMS_HOOK_CONTENT,
				},
			});

			state.useCompatSearchParamsHookCreated = true;
		}

		commands.push({
			kind: 'upsertFile',
			path,
			options,
		});

		return commands;
	},
	handleData: async (
		api,
		path,
		data,
		{
			useCompatSearchParamsHookAbsolutePath,
			useCompatSearchParamsHookModuleSpecifier,
		},
	) => {
		if (
			typeof useCompatSearchParamsHookAbsolutePath !== 'string' ||
			typeof useCompatSearchParamsHookModuleSpecifier !== 'string'
		) {
			throw new Error('Missing required options');
		}

		if (path === useCompatSearchParamsHookAbsolutePath) {
			return {
				kind: 'upsertData',
				path,
				data: USE_COMPAT_SEARCH_PARAMS_HOOK_CONTENT,
			};
		}

		const { jscodeshift } = api.getDependencies();

		try {
			transform(jscodeshift, data, {
				useCompatSearchParamsHookAbsolutePath,
				useCompatSearchParamsHookModuleSpecifier,
			});
		} catch (e) {
			console.error(e);
		}
		const rewrittenData = transform(jscodeshift, data, {
			useCompatSearchParamsHookAbsolutePath,
			useCompatSearchParamsHookModuleSpecifier,
		});

		if (rewrittenData === undefined) {
			return noop;
		}

		return {
			kind: 'upsertData',
			path,
			data: rewrittenData,
		};
	},
};
