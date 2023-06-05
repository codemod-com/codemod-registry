import {
	API,
	Collection,
	FileInfo,
	FunctionDeclaration,
	JSCodeshift,
	ObjectPattern,
	Options,
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

// @TODO
function findLastIndex<T>(
	array: Array<T>,
	predicate: (value: T, index: number, obj: T[]) => boolean,
): number {
	let l = array.length;
	while (l--) {
		if (predicate(array[l]!, l, array)) return l;
	}
	return -1;
}

export const findGetStaticPropsFunctions: ModFunction<File, 'read'> = (
	j,
	root,
	settings,
) => {
	const lazyModFunctions: LazyModFunction[] = [];

	root.find(j.FunctionDeclaration, {
		id: {
			type: 'Identifier',
		},
	})
		.filter((functionDeclarationPath) => {
			const identifierName =
				functionDeclarationPath.value.id?.name ?? null;

			if (identifierName === null) {
				return false;
			}

			return ['getStaticProps', 'getServerSideProps'].includes(
				identifierName,
			);
		})
		.forEach((functionDeclarationPath) => {
			const functionDeclarationCollection = j(functionDeclarationPath);

			lazyModFunctions.push(
				[findReturnStatements, functionDeclarationCollection, settings],
				[
					addCommentOnFunctionDeclaration,
					functionDeclarationCollection,
					settings,
				],
			);
		});

	const variableDeclaratorCollection = root
		.find(j.VariableDeclarator, {
			id: {
				type: 'Identifier',
			},
		})
		.filter((variableDeclaratorPath) => {
			const identifierName =
				variableDeclaratorPath.value.id.type === 'Identifier'
					? variableDeclaratorPath.value.id.name
					: null;

			if (identifierName === null) {
				return false;
			}

			return ['getStaticProps', 'getServerSideProps'].includes(
				identifierName,
			);
		});

	variableDeclaratorCollection
		.find(j.ArrowFunctionExpression)
		.forEach((arrowFunctionPath) => {
			const arrowFunctionCollection = j(arrowFunctionPath);

			// only direct child of variableDeclarator
			if (
				arrowFunctionPath.parent?.value?.id?.name !== 'getStaticProps'
			) {
				return;
			}

			// @TODO handle arrow fn without explicit return
			lazyModFunctions.push(
				[findReturnStatements, arrowFunctionCollection, settings],
				[
					addCommentOnFunctionDeclaration,
					variableDeclaratorCollection,
					settings,
				],
			);
		});

	return [false, lazyModFunctions];
};

export const addCommentOnFunctionDeclaration: ModFunction<
	FunctionDeclaration,
	'write'
> = (j, root) => {
	const lazyModFunctions: LazyModFunction[] = [];
	let dirtyFlag = false;

	root.forEach((functionDeclarationPath) => {
		dirtyFlag = true;

		functionDeclarationPath.value.comments = [
			...(functionDeclarationPath.value.comments ?? []),
			j.commentLine(' TODO: remove this function'),
		];
	});

	return [dirtyFlag, lazyModFunctions];
};

export const findReturnStatements: ModFunction<FunctionDeclaration, 'read'> = (
	j,
	root,
	settings,
) => {
	const lazyModFunctions: LazyModFunction[] = [];

	root.find(j.ReturnStatement).forEach((returnStatementPath) => {
		const returnStatementCollection = j(returnStatementPath);

		lazyModFunctions.push(
			[findPropsObjectProperty, returnStatementCollection, settings],
			[findRevalidateObjectProperty, returnStatementCollection, settings],
		);
	});

	return [false, lazyModFunctions];
};

export const findRevalidateObjectProperty: ModFunction<any, 'read'> = (
	j,
	root,
	settings,
) => {
	const lazyModFunctions: LazyModFunction[] = [];

	const fileCollection = root.closest(j.File);

	root.find(j.ObjectProperty, {
		key: {
			type: 'Identifier',
			name: 'revalidate',
		},
		value: {
			type: 'NumericLiteral',
		},
	}).forEach((objectPropertyPath) => {
		const objectPropertyCollection = j(objectPropertyPath);

		objectPropertyCollection
			.find(j.NumericLiteral)
			.forEach((numericLiteralPath) => {
				const numericLiteral = numericLiteralPath.value;

				const revalidate = String(numericLiteral.value);

				lazyModFunctions.push([
					addRevalidateVariableDeclaration,
					fileCollection,
					{ revalidate },
				]);
			});
	});

	return [false, lazyModFunctions];
};

export const addRevalidateVariableDeclaration: ModFunction<any, 'write'> = (
	j,
	root,
	settings,
) => {
	const exportNamedDeclarationAlreadyExists =
		root.find(j.ExportNamedDeclaration, {
			declaration: {
				declarations: [
					{
						type: 'VariableDeclarator',
						id: {
							type: 'Identifier',
							name: 'revalidate',
						},
					},
				],
			},
		})?.length !== 0;

	if (exportNamedDeclarationAlreadyExists) {
		return [false, []];
	}

	const revalidate = parseInt(settings.revalidate ?? '0', 10);

	const exportNamedDeclaration = j.exportNamedDeclaration(
		j.variableDeclaration('const', [
			j.variableDeclarator(
				j.identifier('revalidate'),
				j.numericLiteral(revalidate),
			),
		]),
	);

	let dirtyFlag = false;

	root.find(j.Program).forEach((program) => {
		dirtyFlag = true;

		program.value.body.push(exportNamedDeclaration);
	});

	return [dirtyFlag, []];
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

export const findObjectProperties: ModFunction<any, 'read'> = (j, root) => {
	const lazyModFunctions: LazyModFunction[] = [];

	const fileCollection = root.closest(j.File);

	root.find(j.ObjectProperty, {
		key: {
			type: 'Identifier',
		},
	}).forEach((objectPropertyPath) => {
		const objectProperty = objectPropertyPath.value;

		if (objectProperty.key.type !== 'Identifier') {
			return;
		}

		const { name } = objectProperty.key;

		lazyModFunctions.push(
			[
				addGetXFunctionDefinition,
				fileCollection,
				{
					name,
				},
			],
			[
				findComponentFunctionDefinition,
				fileCollection,
				{
					name,
				},
			],
		);
	});

	return [false, lazyModFunctions];
};

export const addGetXFunctionDefinition: ModFunction<File, 'write'> = (
	j,
	root,
	settings,
) => {
	const name = 'name' in settings ? settings.name ?? '' : '';

	const identifierName = name
		.split('')
		.map((character, i) => (i == 0 ? character.toUpperCase() : character))
		.join('');

	const functionDeclaration = j.functionDeclaration.from({
		async: true,
		body: j.blockStatement([]),
		id: j.identifier(`get${identifierName}`),
		comments: [j.commentLine(' TODO: implement this function')],
		params: [],
	});

	let dirtyFlag = false;

	root.find(j.Program).forEach((program) => {
		dirtyFlag = true;

		const lastImportDeclarationIndex = findLastIndex(
			program.value.body,
			(node) => node.type === 'ImportDeclaration',
		);

		const functionDeclarationAlreadyExists =
			program.value.body.findIndex((node) => {
				return (
					node.type === 'FunctionDeclaration' &&
					node.id?.type === 'Identifier' &&
					node.id?.name === `get${identifierName}`
				);
			}) !== -1;

		if (functionDeclarationAlreadyExists) {
			return;
		}

		const insertPosition =
			lastImportDeclarationIndex === -1
				? 0
				: lastImportDeclarationIndex + 1;

		program.value.body.splice(insertPosition, 0, functionDeclaration);
	});

	return [dirtyFlag, []];
};

export const findComponentFunctionDefinition: ModFunction<File, 'read'> = (
	j,
	root,
	settings,
) => {
	const lazyModFunctions: LazyModFunction[] = [];

	// @TODO component can be arrow function
	// @TODO get Component from the DefaultExport (more reliable)
	root.find(j.FunctionDeclaration, {
		id: {
			type: 'Identifier',
		},
	}).forEach((functionDeclarationPath) => {
		const functionDeclaration = functionDeclarationPath.value;

		if (functionDeclaration.id?.type !== 'Identifier') {
			return;
		}

		const firstCharacter = functionDeclaration.id.name.charAt(0);

		if (firstCharacter !== firstCharacter.toUpperCase()) {
			return;
		}

		const functionDeclarationCollection = j(functionDeclarationPath);

		lazyModFunctions.push(
			[
				findObjectPatternsWithFunctionDeclaration,
				functionDeclarationCollection,
				settings,
			],
			[addVariableDeclarations, functionDeclarationCollection, settings],
		);
	});

	return [false, lazyModFunctions];
};

export const addVariableDeclarations: ModFunction<
	FunctionDeclaration,
	'write'
> = (j, root, settings) => {
	const name = 'name' in settings ? settings.name ?? '' : '';
	const identifierName = name
		.split('')
		.map((character, i) => (i == 0 ? character.toUpperCase() : character))
		.join('');

	const variableDeclaration = j.variableDeclaration('const', [
		j.variableDeclarator(
			j.identifier(name),
			j.awaitExpression(
				j.callExpression(j.identifier(`get${identifierName}`), []),
			),
		),
	]);

	let addedVariableDeclaration = false;
	root.find(j.BlockStatement).forEach((blockStatementPath) => {
		const blockStatement = blockStatementPath.value;
		// only add variableDeclaration to blackStatement if its direct child of the FunctionDeclaration
		if (blockStatementPath.parentPath !== root.paths()[0]) {
			return;
		}

		const variableDeclarationAlreadyExists =
			blockStatement.body.findIndex((node) => {
				return (
					node.type === 'VariableDeclaration' &&
					node.declarations[0]?.type === 'VariableDeclarator' &&
					node.declarations[0]?.id?.type === 'Identifier' &&
					node.declarations[0]?.id.name === name
				);
			}) !== -1;

		if (variableDeclarationAlreadyExists) {
			return;
		}

		blockStatement.body.unshift(variableDeclaration);
		addedVariableDeclaration = true;
	});

	root.forEach((functionDeclarationPath) => {
		if (addedVariableDeclaration && !functionDeclarationPath.value.async) {
			functionDeclarationPath.value.async = true;
		}
	});

	return [true, []];
};

export const findObjectPatternsWithFunctionDeclaration: ModFunction<
	FunctionDeclaration,
	'read'
> = (j, root, settings) => {
	const lazyModFunctions: LazyModFunction[] = [];

	root.find(j.ObjectPattern).forEach((objectPatternPath) => {
		const objectPatternCollection = j(objectPatternPath);

		lazyModFunctions.push([
			findObjectPropertiesWithinFunctionParameters,
			objectPatternCollection,
			settings,
		]);
	});

	return [false, lazyModFunctions];
};

export const findObjectPropertiesWithinFunctionParameters: ModFunction<
	ObjectPattern,
	'read'
> = (j, root, settings) => {
	const name = 'name' in settings ? settings.name ?? '' : '';

	const objectPropertyCollection = root.find(j.ObjectProperty, {
		key: {
			type: 'Identifier',
			name,
		},
	});

	const lazyModFunctions: LazyModFunction[] = [
		[removeCollection, objectPropertyCollection, settings],
	];

	return [false, lazyModFunctions];
};

export const removeCollection: ModFunction<any, 'write'> = (_, root, __) => {
	if (!root.length) {
		return [false, []];
	}

	root.remove();

	return [true, []];
};

export default function transform(
	file: FileInfo,
	api: API,
	_: Options,
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
