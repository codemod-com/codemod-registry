import {
	API,
	Collection,
	FileInfo,
	JSCodeshift,
	Options,
	Transform,
} from 'jscodeshift';

type AtomicMod = (
	j: JSCodeshift,
	root: Collection<any>,
	settings: Partial<Record<string, string>>,
) => [boolean, ReadonlyArray<LazyAtomicMod>];

type LazyAtomicMod = [
	AtomicMod,
	Collection<any>,
	Partial<Record<string, string>>,
];

export const upsertTypeAnnotationOnStateIdentifier: AtomicMod = (
	j,
	root,
	settings,
) => {
	let dirtyFlag: boolean = false;

	if (
		!root.isOfType(j.ArrowFunctionExpression) &&
		!root.isOfType(j.FunctionDeclaration)
	) {
		return [dirtyFlag, []];
	}

	root.forEach((arrowFunctionExpressionPath) => {
		const patternKind = arrowFunctionExpressionPath.value.params[0];

		if (patternKind?.type !== 'Identifier') {
			return;
		}

		const identifierPathCollection = j(arrowFunctionExpressionPath).find(
			j.Identifier,
			{
				name: patternKind.name,
			},
		);

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

	return [dirtyFlag, [[addImportStatement, filePath, settings]]];
};

export const upsertTypeAnnotationOnStateObjectPattern: AtomicMod = (
	j,
	root,
	settings,
) => {
	let dirtyFlag: boolean = false;

	if (!root.isOfType(j.ArrowFunctionExpression)) {
		return [dirtyFlag, []];
	}

	root.forEach((arrowFunctionExpressionPath) => {
		const patternKind = arrowFunctionExpressionPath.value.params[0];

		if (patternKind?.type !== 'ObjectPattern') {
			return;
		}

		const objectPatternPathCollection = j(arrowFunctionExpressionPath).find(
			j.ObjectPattern,
		);

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

	return [dirtyFlag, [[addImportStatement, filePath, settings]]];
};

export const upsertTypeAnnotationOnStateDestructuredParameterOfMapStateToProps: AtomicMod =
	(j, root, settings) => {
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
				.filter((arrowFunctionExpressionPath) => {
					return (
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

export const upsertTypeAnnotationOnMapStateToPropsFunction: AtomicMod = (
	j,
	root,
	settings,
) => {
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
	});

	return [false, lazyAtomicMods];
};

export const addImportStatement: AtomicMod = (
	j: JSCodeshift,
	root: Collection<any>,
	settings,
) => {
	const importDeclaration = j.importDeclaration(
		[
			j.importSpecifier(
				j.identifier(settings.stateTypeIdentifierName ?? 'State'),
				j.identifier(settings.stateTypeIdentifierName ?? 'State'),
			),
		],
		j.stringLiteral(settings.stateSourceLiteralValue ?? 'state'),
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
		[
			upsertTypeAnnotationOnStateDestructuredParameterOfMapStateToProps,
			root,
			settings,
		],
		[upsertTypeAnnotationOnMapStateToPropsFunction, root, settings],
	];

	while (true) {
		const last = lazyAtomicMods.pop();

		if (!last) {
			break;
		}

		const [newDirtyFlag, newMods] = last[0](j, last[1], last[2]);

		dirtyFlag ||= newDirtyFlag;

		// newMods: 0, 1, 2
		// 2, 1, 0 so 0 gets picked first

		for (const newMod of newMods) {
			lazyAtomicMods.unshift(newMod);
		}
	}

	if (!dirtyFlag) {
		return undefined;
	}

	return root.toSource();
}

transform satisfies Transform;
