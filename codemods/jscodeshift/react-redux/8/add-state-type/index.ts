import {
	API,
	ArrowFunctionExpression,
	Collection,
	File,
	FileInfo,
	FunctionDeclaration,
	JSCodeshift,
	Options,
	Transform,
} from 'jscodeshift';

type AtomicMod<T, D extends 'find' | 'replace'> = (
	j: JSCodeshift,
	root: Collection<T>,
	settings: Partial<Record<string, string>>,
) => [D extends 'replace' ? boolean : false, ReadonlyArray<LazyAtomicMod>];

type LazyAtomicMod = [
	AtomicMod<any, 'find' | 'replace'>,
	Collection<any>,
	Partial<Record<string, string>>,
];

export const upsertTypeAnnotationOnStateIdentifier: AtomicMod<
	ArrowFunctionExpression | FunctionDeclaration,
	'replace'
> = (j, root, settings) => {
	let dirtyFlag: boolean = false;

	if (
		!root.isOfType(j.ArrowFunctionExpression) &&
		!root.isOfType(j.FunctionDeclaration)
	) {
		return [dirtyFlag, []];
	}

	root.forEach((astPath) => {
		const patternKind = astPath.value.params[0];

		if (patternKind?.type !== 'Identifier') {
			return;
		}

		const identifierPathCollection = j(astPath).find(j.Identifier, {
			name: patternKind.name,
		});

		const typeAnnotation = j.typeAnnotation(
			j.genericTypeAnnotation(
				j.identifier(settings.stateTypeIdentifierName ?? 'State'),
				null,
			),
		);

		dirtyFlag = true;

		// this uses the fact that the state parameter must be the first
		// found identifier under the arrow-function-expression
		identifierPathCollection.paths()[0]?.replace(
			j.identifier.from({
				comments: patternKind.comments ?? null,
				name: patternKind.name,
				optional: patternKind.optional,
				typeAnnotation,
			}),
		);
	});

	const filePath = root.closest(j.File);

	if (!dirtyFlag) {
		return [dirtyFlag, []];
	}

	return [dirtyFlag, [[findStateImportDeclarations, filePath, settings]]];
};

export const upsertTypeAnnotationOnDispatchIdentifier: AtomicMod<
	ArrowFunctionExpression | FunctionDeclaration,
	'replace'
> = (j, root, settings) => {
	let dirtyFlag: boolean = false;

	if (
		!root.isOfType(j.ArrowFunctionExpression) &&
		!root.isOfType(j.FunctionDeclaration)
	) {
		return [dirtyFlag, []];
	}

	root.forEach((astPath) => {
		const patternKind = astPath.value.params[0];

		if (patternKind?.type !== 'Identifier') {
			return;
		}

		const identifierPathCollection = j(astPath).find(j.Identifier, {
			name: patternKind.name,
		});

		const typeAnnotation = j.typeAnnotation(
			j.genericTypeAnnotation(
				j.identifier('ThunkDispatch'),
				j.typeParameterInstantiation([
					j.genericTypeAnnotation(
						j.identifier(
							settings.stateTypeIdentifierName ?? 'State',
						),
						null,
					),
					j.anyTypeAnnotation(),
					j.anyTypeAnnotation(),
				]),
			),
		);

		dirtyFlag = true;

		// this uses the fact that the state parameter must be the first
		// found identifier under the arrow-function-expression
		identifierPathCollection.paths()[0]?.replace(
			j.identifier.from({
				comments: patternKind.comments ?? null,
				name: patternKind.name,
				optional: patternKind.optional,
				typeAnnotation,
			}),
		);
	});

	const filePath = root.closest(j.File);

	if (!dirtyFlag) {
		return [dirtyFlag, []];
	}

	return [
		dirtyFlag,
		[
			[findStateImportDeclarations, filePath, settings],
			[addThunkDispatchImportDeclaration, filePath, settings],
		],
	];
};

export const upsertTypeAnnotationOnStateObjectPattern: AtomicMod<
	ArrowFunctionExpression | FunctionDeclaration,
	'replace'
> = (j, root, settings) => {
	let dirtyFlag: boolean = false;

	if (
		!root.isOfType(j.ArrowFunctionExpression) &&
		!root.isOfType(j.FunctionDeclaration)
	) {
		return [dirtyFlag, []];
	}

	root.forEach((astPath) => {
		const patternKind = astPath.value.params[0];

		if (patternKind?.type !== 'ObjectPattern') {
			return;
		}

		const objectPatternPathCollection = j(astPath).find(j.ObjectPattern);

		const typeAnnotation = j.typeAnnotation(
			j.genericTypeAnnotation(
				j.identifier(settings.stateTypeIdentifierName ?? 'State'),
				null,
			),
		);
		dirtyFlag = true;

		// this uses the fact that the state parameter must be the first
		// found object pattern under the arrow-function-expression
		objectPatternPathCollection.paths()[0]?.replace(
			j.objectPattern.from({
				comments: patternKind.comments ?? null,
				decorators: patternKind.decorators,
				properties: patternKind.properties,
				typeAnnotation,
			}),
		);
	});

	const filePath = root.closest(j.File);

	if (!dirtyFlag) {
		return [dirtyFlag, []];
	}

	return [dirtyFlag, [[findStateImportDeclarations, filePath, settings]]];
};

export const upsertTypeAnnotationOnMapStateToPropsArrowFunction: AtomicMod<
	File,
	'replace'
> = (j, root, settings) => {
	const lazyAtomicMods: LazyAtomicMod[] = [];

	root.find(j.VariableDeclarator, {
		id: {
			type: 'Identifier',
			name: 'mapStateToProps',
		},
		init: {
			type: 'ArrowFunctionExpression',
		},
	}).forEach((variableDeclaratorPath) => {
		const collection = j(variableDeclaratorPath)
			.find(j.ArrowFunctionExpression)
			.filter((arrowFunctionExpressionPath, i) => {
				return (
					i === 0 &&
					arrowFunctionExpressionPath.value.params.length !== 0
				);
			});

		lazyAtomicMods.push([
			upsertTypeAnnotationOnStateIdentifier,
			collection,
			settings,
		]);

		lazyAtomicMods.push([
			upsertTypeAnnotationOnStateObjectPattern,
			collection,
			settings,
		]);
	});

	return [false, lazyAtomicMods];
};

export const upsertTypeAnnotationOnMapStateToPropsFunction: AtomicMod<
	File,
	'find'
> = (j, root, settings) => {
	const lazyAtomicMods: LazyAtomicMod[] = [];

	root.find(j.FunctionDeclaration, {
		id: {
			type: 'Identifier',
			name: 'mapStateToProps',
		},
	}).forEach((functionDeclarationPath) => {
		if (functionDeclarationPath.value.params.length === 0) {
			return;
		}

		const collection = j(functionDeclarationPath);

		lazyAtomicMods.push([
			upsertTypeAnnotationOnStateIdentifier,
			collection,
			settings,
		]);

		lazyAtomicMods.push([
			upsertTypeAnnotationOnStateObjectPattern,
			collection,
			settings,
		]);
	});

	return [false, lazyAtomicMods];
};

export const findMapDispatchToPropsArrowFunctions: AtomicMod<File, 'find'> = (
	j,
	root,
	settings,
) => {
	const lazyAtomicMods: LazyAtomicMod[] = [];

	root.find(j.VariableDeclarator, {
		id: {
			type: 'Identifier',
			name: 'mapDispatchToProps',
		},
		init: {
			type: 'ArrowFunctionExpression',
		},
	}).forEach((variableDeclaratorPath) => {
		const collection = j(variableDeclaratorPath)
			.find(j.ArrowFunctionExpression)
			.filter((arrowFunctionExpressionPath, i) => {
				return (
					i === 0 &&
					arrowFunctionExpressionPath.value.params.length !== 0
				);
			});

		lazyAtomicMods.push([
			upsertTypeAnnotationOnDispatchIdentifier,
			collection,
			settings,
		]);
	});

	return [false, lazyAtomicMods];
};

export const upsertTypeAnnotationOnMapDispatchToPropsFunction: AtomicMod<
	File,
	'find'
> = (j, root, settings) => {
	const lazyAtomicMods: LazyAtomicMod[] = [];

	root.find(j.FunctionDeclaration, {
		id: {
			type: 'Identifier',
			name: 'mapDispatchToProps',
		},
	}).forEach((functionDeclarationPath) => {
		if (functionDeclarationPath.value.params.length === 0) {
			return;
		}

		const collection = j(functionDeclarationPath);

		lazyAtomicMods.push([
			upsertTypeAnnotationOnDispatchIdentifier,
			collection,
			settings,
		]);
	});

	return [false, lazyAtomicMods];
};

export const findStateImportDeclarations: AtomicMod<File, 'find'> = (
	j,
	root,
	settings,
) => {
	const stateTypeIdentifierName = settings.stateTypeIdentifierName ?? 'State';
	const existingDeclarations = root.find(j.ImportDeclaration, {
		specifiers: [
			{
				imported: {
					type: 'Identifier',
					name: stateTypeIdentifierName,
				},
			},
		],
		source: {
			value: settings.stateSourceLiteralValue ?? 'state',
		},
	});

	if (existingDeclarations.size() !== 0) {
		return [false, []];
	}

	return [false, [[addStateImportDeclaration, root, settings]]];
};

export const addStateImportDeclaration: AtomicMod<File, 'replace'> = (
	j,
	root,
	settings,
) => {
	const stateTypeIdentifierName = settings.stateTypeIdentifierName ?? 'State';
	const stateSourceLiteralValue = settings.stateSourceLiteralValue ?? 'state';

	const importDeclaration = j.importDeclaration(
		[
			j.importSpecifier(
				j.identifier(stateTypeIdentifierName),
				j.identifier(stateTypeIdentifierName),
			),
		],
		j.stringLiteral(stateSourceLiteralValue),
	);

	root.find(j.Program).forEach((programPath) => {
		programPath.value.body.unshift(importDeclaration);
	});

	return [true, []];
};

export const addThunkDispatchImportDeclaration: AtomicMod<File, 'replace'> = (
	j,
	root,
) => {
	const existingDeclarations = root.find(j.ImportDeclaration, {
		specifiers: [
			{
				imported: {
					type: 'Identifier',
					name: 'ThunkDispatch',
				},
			},
		],
		source: {
			value: 'redux-thunk',
		},
	});

	if (existingDeclarations.size() !== 0) {
		return [false, []];
	}

	const importDeclaration = j.importDeclaration(
		[
			j.importSpecifier(
				j.identifier('ThunkDispatch'),
				j.identifier('ThunkDispatch'),
			),
		],
		j.stringLiteral('redux-thunk'),
	);

	root.find(j.Program).forEach((programPath) => {
		programPath.value.body.unshift(importDeclaration);
	});

	return [true, []];
};

export default function transform(file: FileInfo, api: API, jOptions: Options) {
	const j = api.jscodeshift;

	let dirtyFlag = false;

	const root = j(file.source);

	const settings = {
		stateTypeIdentifierName:
			'stateTypeIdentifierName' in jOptions
				? String(jOptions.stateTypeIdentifierName)
				: 'State',
		stateSourceLiteralValue:
			'stateSourceLiteralValue' in jOptions
				? String(jOptions.stateSourceLiteralValue)
				: 'state',
	};

	const lazyAtomicMods: LazyAtomicMod[] = [
		[upsertTypeAnnotationOnMapStateToPropsArrowFunction, root, settings],
		[upsertTypeAnnotationOnMapStateToPropsFunction, root, settings],
		[findMapDispatchToPropsArrowFunctions, root, settings],
		[upsertTypeAnnotationOnMapDispatchToPropsFunction, root, settings],
	];

	const handleLazyAtomicMod = (lazyAtomicMod: LazyAtomicMod) => {
		const [newDirtyFlag, newMods] = lazyAtomicMod[0](
			j,
			lazyAtomicMod[1],
			lazyAtomicMod[2],
		);

		dirtyFlag ||= newDirtyFlag;

		for (const newMod of newMods) {
			handleLazyAtomicMod(newMod);
		}
	};

	for (const lazyAtomicMod of lazyAtomicMods) {
		handleLazyAtomicMod(lazyAtomicMod);
	}

	if (!dirtyFlag) {
		return undefined;
	}

	return root.toSource();
}

transform satisfies Transform;
