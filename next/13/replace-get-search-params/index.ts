import {
	CallExpression,
	Collection,
	File,
	ImportDeclaration,
	JSCodeshift,
} from 'jscodeshift';
import jscodeshift from 'jscodeshift';

import type { HandleFile, Repomod } from '@intuita-inc/repomod-engine-api';

type Settings = { hookPath: string };

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
	settings,
) => {
	root.find(j.Program).forEach((programPath) => {
		programPath.value.body.unshift(
			j.importDeclaration(
				[j.importSpecifier(j.identifier('useCompatSearchParams'))],
				j.literal(`${settings.hookPath}/useCompatSearchParams`),
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

	root.find(j.ImportDeclaration)
		.filter((importDeclarationPath) => {
			const sourceValue = importDeclarationPath.value.source.value;
			return (
				sourceValue === 'next/navigation' ||
				sourceValue === 'next/router'
			);
		})
		.forEach((importDeclarationPath) => {
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

const useCompatSearchParamsHookContent = `
import { ReadonlyURLSearchParams, useParams, useSearchParams } from "next/navigation"

type ParsedUrlQuery = Record<string, string | string[]>;

// ref: https://github.com/vercel/next.js/blob/ab7b0f59fb0d793fb4ee593ae93f7e08bab23b5b/packages/next/src/shared/lib/router/utils/querystring.ts#L3C17-L3C39

export const searchParamsToUrlQuery = (
    searchParams: ReadonlyURLSearchParams
  ): ParsedUrlQuery => {
    const query: ParsedUrlQuery = {}

    searchParams.forEach((value, key) => {
      if (!query.hasOwnProperty(key)) {
        query[key] = value
      } else if (Array.isArray(query[key])) {
        (query[key] as string[]).push(value)
      } else {
        query[key] = [query[key] as string, value]
      }
    })
    return query
  }

  
export const useCompatSearchParams = () => {
    const _searchParams = useSearchParams();
    const params = useParams() ?? {};

    const searchParams =  searchParamsToUrlQuery(_searchParams);

    const paramsAsObj = {
      ...searchParams, 
      // Merge params into \`query\`, overwriting any specified in search
      //ref: https://github.com/vercel/next.js/blob/ab7b0f59fb0d793fb4ee593ae93f7e08bab23b5b/packages/next/src/shared/lib/router/router.ts#L1502
      ...params,
  };

   return new Map(Object.entries(paramsAsObj));
}
`;

type Dependencies = {
	jscodeshift: typeof jscodeshift;
};

type State = {
	useCompatSearchParamsHookCreated: boolean;
};

type FileCommand = Awaited<ReturnType<HandleFile<Dependencies, State>>>[number];

const enum FilePurpose {
	USE_COMPAT_SEARCH_PARAMS_HOOK = 'USE_COMPAT_SEARCH_PARAMS_HOOK',
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

		commands.push({
			kind: 'upsertFile',
			path,
			options,
		});

		if (state !== null && !state.useCompatSearchParamsHookCreated) {
			state.useCompatSearchParamsHookCreated = true;
			const hookPath =
				typeof options.hookPath === 'string'
					? options.hookPath
					: 'hooks';

			commands.push({
				kind: 'upsertFile',
				path: `${hookPath}/useCompatSearchParams.tsx`,
				options: {
					...options,
					filePurpose: FilePurpose.USE_COMPAT_SEARCH_PARAMS_HOOK,
					fileContent: useCompatSearchParamsHookContent,
				},
			});
		}

		return commands;
	},
	handleData: async (
		api,
		path,
		data,
		{ hookPath, filePurpose, fileContent },
	) => {
		if (
			filePurpose === FilePurpose.USE_COMPAT_SEARCH_PARAMS_HOOK &&
			typeof fileContent === 'string'
		) {
			return {
				kind: 'upsertData',
				path,
				data: fileContent,
			};
		}

		const { jscodeshift } = api.getDependencies();

		if (typeof hookPath !== 'string') {
			throw new Error('Missing hookPath');
		}

		if (!data.includes('useSearchParams')) {
			return noop;
		}

		const rewrittenData = transform(jscodeshift, data, { hookPath });

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
