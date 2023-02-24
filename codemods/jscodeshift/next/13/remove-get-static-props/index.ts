import type {
	API,
	Collection,
	FileInfo,
	FunctionDeclaration,
	JSCodeshift,
	Options,
	ReturnStatement,
	Transform,
} from 'jscodeshift';

type ModFunction<T, D extends 'read' | 'write'> = (
	j: JSCodeshift,
	root: Collection<T>,
	settings: Partial<Record<string, string>>,
) => [D extends 'write' ? boolean : false, ReadonlyArray<LazyModFunction>];

type LazyModFunction = [
	ModFunction<any, 'read' | 'write'>,
	Collection<any>,
	Partial<Record<string, string>>,
];

export const findGetStaticPropsFunctions: ModFunction<File, 'read'> = (
	j,
	root,
	settings,
) => {
	const lazyModFunctions: LazyModFunction[] = [];

	root.find(j.FunctionDeclaration, {
		id: {
			type: 'Identifier',
			name: 'getStaticProps',
		},
	}).forEach((functionDeclarationPath) => {
		const functionDeclarationCollection = j(functionDeclarationPath);

		lazyModFunctions.push([
			findReturnStatements,
			functionDeclarationCollection,
			settings,
		]);
	});

	return [false, lazyModFunctions];
};

export const findReturnStatements: ModFunction<FunctionDeclaration, 'read'> = (
	j,
	root,
	settings,
) => {
	const lazyModFunctions: LazyModFunction[] = [];

	root.find(j.ReturnStatement).forEach((returnStatementPath) => {
		const returnStatementCollection = j(returnStatementPath);

		lazyModFunctions.push([
			findPropsObjectProperty,
			returnStatementCollection,
			settings,
		]);
	});

	return [false, lazyModFunctions];
};

export const findPropsObjectProperty: ModFunction<any, 'read'> = (
	j,
	root,
	settings,
) => {
	const lazyModFunctions: LazyModFunction[] = [];

	root.find(j.ObjectProperty, {
		key: {
			type: 'Identifier',
			name: 'props',
		},
	}).forEach((objectPropertyPath) => {
		const objectPropertyCollection = j(objectPropertyPath);

		lazyModFunctions.push([
			findObjectProperties,
			objectPropertyCollection,
			settings,
		]);
	});

	return [false, lazyModFunctions];
};

export const findObjectProperties: ModFunction<any, 'read'> = (
	j,
	root,
	settings,
) => {
	const lazyModFunctions: LazyModFunction[] = [];

	root.find(j.ObjectProperty, {
		key: {
			type: 'Identifier',
		},
	}).forEach((objectPropertyPath) => {
		const objectProperty = objectPropertyPath.value;

		if (objectProperty.key.type !== 'Identifier') {
			return;
		}

		console.log(objectProperty.key.name);
	});

	return [false, lazyModFunctions];
};

export default function transform(
	file: FileInfo,
	api: API,
	options: Options,
): string | undefined {
	const j = api.jscodeshift;

	let dirtyFlag = false;

	const root = j(file.source);
	const settings = {};

	const lazyModFunctions: LazyModFunction[] = [
		[findGetStaticPropsFunctions, root, settings],
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

	return root.toSource();
}

transform satisfies Transform;
