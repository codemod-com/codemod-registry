import {
	API,
	ASTNode,
	ArrowFunctionExpression,
	Collection,
	FileInfo,
	FunctionDeclaration,
	JSCodeshift,
	ObjectPattern,
	ObjectProperty,
	Options,
	Transform,
} from 'jscodeshift';

type ModFunction<T, D extends 'read' | 'write'> = (
	j: JSCodeshift,
	root: Collection<T>,
	settings: Partial<Record<string, string | boolean>>,
) => [D extends 'write' ? boolean : false, ReadonlyArray<LazyModFunction>];

type LazyModFunction = [
	ModFunction<any, 'read' | 'write'>,
	Collection<any>,
	Partial<Record<string, string | boolean>>,
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

/**
 * factories
 */

const generateStaticParamsMethodFactory = (j: JSCodeshift) => {
	return j.exportNamedDeclaration(
		j.functionDeclaration.from({
			async: true,
			body: j.blockStatement([j.returnStatement(j.arrayExpression([]))]),
			id: j.identifier('generateStaticParams'),
			comments: [j.commentLine(' TODO: implement this function')],
			params: [],
		}),
	);
};

const serverHookParamsFactory = (j: JSCodeshift) => {
	return j.identifier.from({
		name: 'params',
		typeAnnotation: j.tsTypeAnnotation(
			j.tsTypeReference(j.identifier('PageParams')),
		),
	});
};

const addGenerateStaticParamsFunctionDeclaration: ModFunction<File, 'write'> = (
	j,
	root,
) => {
	const generateStaticParamsMethod = generateStaticParamsMethodFactory(j);

	root.find(j.Program).forEach((program) => {
		const lastImportDeclarationIndex = findLastIndex(
			program.value.body,
			(node) => node.type === 'ImportDeclaration',
		);

		const insertPosition =
			lastImportDeclarationIndex === -1
				? 0
				: lastImportDeclarationIndex + 1;

		program.value.body.splice(
			insertPosition,
			0,
			generateStaticParamsMethod,
		);
	});

	return [true, []];
};

const addPageParamsTypeAlias: ModFunction<File, 'write'> = (j, root) => {
	const pageParamsType = j.tsTypeAliasDeclaration(
		j.identifier('PageParams'),
		j.tsTypeLiteral([]),
	);

	const pagePropsType = j.tsTypeAliasDeclaration(
		j.identifier('PageProps'),
		j.tsTypeLiteral([
			j.tsPropertySignature(
				j.identifier('params'),
				j.tsTypeAnnotation(
					j.tsTypeReference(j.identifier('PageParams')),
				),
			),
		]),
	);

	root.find(j.Program).forEach((program) => {
		const lastImportDeclarationIndex = findLastIndex(
			program.value.body,
			(node) => node.type === 'ImportDeclaration',
		);

		const insertPosition =
			lastImportDeclarationIndex === -1
				? 0
				: lastImportDeclarationIndex + 1;

		program.value.body.splice(
			insertPosition,
			0,
			...[pageParamsType, pagePropsType],
		);
	});

	return [true, []];
};

const deepCloneCollection = <T extends ASTNode>(
	j: JSCodeshift,
	root: Collection<T>,
) => {
	return j(root.toSource());
};

const addGetDataFunction: ModFunction<
	FunctionDeclaration | ArrowFunctionExpression,
	'write'
> = (j, root) => {
	const cloned = deepCloneCollection(j, root);

	const clonedFunctionDeclarationCollection = cloned.find(
		j.FunctionDeclaration,
	);
	const clonedFArrowFunctionExpressionCollection = cloned.find(
		j.ArrowFunctionExpression,
	);

	const clonedFunction =
		clonedFunctionDeclarationCollection.paths()[0] ??
		clonedFArrowFunctionExpressionCollection.paths()[0] ??
		null;

	if (clonedFunction === null) {
		return [false, []];
	}

	j(clonedFunction)
		.find(j.ReturnStatement)
		.forEach((path) => {
			const node = path.value;

			const argument = node.argument;

			if (argument === null) {
				return;
			}

			// common case #1
			// return { props: ... }
			if (argument.type === 'ObjectExpression') {
				const props =
					j(argument)
						.find(j.ObjectProperty, {
							key: {
								type: 'Identifier',
								name: 'props',
							},
						})
						.paths()[0]?.value ?? null;

				if (props === null) {
					return;
				}

				const propsPropValue = props.value;

				// @TODO find a way to check if propsPropValue is ExpressionKind without making a lot of checks
				if (propsPropValue.type !== 'ObjectExpression') {
					return;
				}

				node.argument = propsPropValue;
			}

			// common case #2
			// res.props = ...;
			// return res;
			if (argument.type === 'Identifier') {
				node.argument = j.memberExpression(
					argument,
					j.identifier('props'),
				);
			}
		});

	const getDataFunctionDeclaration = j.functionDeclaration.from({
		params: clonedFunction.value.params,
		body:
			clonedFunction.value.body.type === 'BlockStatement'
				? clonedFunction.value.body
				: j.blockStatement([]),
		id: j.identifier('getData'),
		async: true,
	});

	const program = root.closest(j.Program);

	const programNode = program.paths()[0] ?? null;

	if (programNode === null) {
		return [false, []];
	}

	const lastImportDeclarationIndex = findLastIndex(
		programNode.value.body,
		(node) => node.type === 'ImportDeclaration',
	);

	const insertPosition =
		lastImportDeclarationIndex === -1 ? 0 : lastImportDeclarationIndex + 1;

	programNode.value.body.splice(
		insertPosition,
		0,
		getDataFunctionDeclaration,
	);

	return [true, []];
};

export const findGetStaticPropsFunctionDeclarations: ModFunction<
	File,
	'read'
> = (j, root, settings) => {
	const lazyModFunctions: LazyModFunction[] = [];

	const functionDeclarations = root.find(j.FunctionDeclaration, {
		id: {
			type: 'Identifier',
			name: 'getStaticProps',
		},
	});

	functionDeclarations.forEach((functionDeclarationPath) => {
		const functionDeclarationCollection = j(functionDeclarationPath);

		lazyModFunctions.push(
			[addGetDataFunction, functionDeclarationCollection, settings],
			[findReturnStatements, functionDeclarationCollection, settings],
			[
				addCommentOnFunctionDeclaration,
				functionDeclarationCollection,
				settings,
			],
			[
				findComponentFunctionDefinition,
				root,
				{ name: '', includeParams: settings.includeParams },
			],
		);
	});

	return [false, lazyModFunctions];
};

export const findGetStaticPropsArrowFunctions: ModFunction<File, 'read'> = (
	j,
	root,
	settings,
) => {
	const lazyModFunctions: LazyModFunction[] = [];

	const arrowFunctionCollection = root
		.find(j.VariableDeclarator, {
			id: {
				type: 'Identifier',
				name: 'getStaticProps',
			},
		})
		.find(j.ArrowFunctionExpression);

	arrowFunctionCollection.forEach((arrowFunctionPath) => {
		const arrowFunctionCollection = j(arrowFunctionPath);

		// only direct child of variableDeclarator
		if (arrowFunctionPath.parent?.value?.id?.name !== 'getStaticProps') {
			return;
		}

		lazyModFunctions.push(
			[addGetDataFunction, arrowFunctionCollection, settings],
			[findReturnStatements, arrowFunctionCollection, settings],
			[
				addCommentOnFunctionDeclaration,
				arrowFunctionCollection,
				settings,
			],
			[
				findComponentFunctionDefinition,
				root,
				{ name: '', includeParams: settings.includeParams },
			],
		);
	});

	return [false, lazyModFunctions];
};

export const findGetServerSidePropsFunctionDeclarations: ModFunction<
	File,
	'read'
> = (j, root, settings) => {
	const lazyModFunctions: LazyModFunction[] = [];

	root.find(j.FunctionDeclaration, {
		id: {
			type: 'Identifier',
			name: 'getServerSideProps',
		},
	}).forEach((functionDeclarationPath) => {
		const functionDeclarationCollection = j(functionDeclarationPath);

		lazyModFunctions.push(
			[addGetDataFunction, functionDeclarationCollection, settings],
			[findReturnStatements, functionDeclarationCollection, settings],
			[
				addCommentOnFunctionDeclaration,
				functionDeclarationCollection,
				settings,
			],
			[
				findComponentFunctionDefinition,
				root,
				{ name: '', includeParams: settings.includeParams },
			],
		);
	});

	return [false, lazyModFunctions];
};

export const findGetServerSidePropsArrowFunctions: ModFunction<File, 'read'> = (
	j,
	root,
	settings,
) => {
	const lazyModFunctions: LazyModFunction[] = [];

	const arrowFunctionCollection = root
		.find(j.VariableDeclarator, {
			id: {
				type: 'Identifier',
				name: 'getServerSideProps',
			},
		})
		.find(j.ArrowFunctionExpression);

	arrowFunctionCollection.forEach((arrowFunctionPath) => {
		const arrowFunctionCollection = j(arrowFunctionPath);

		// only direct child of variableDeclarator
		if (
			arrowFunctionPath.parent?.value?.id?.name !== 'getServerSideProps'
		) {
			return;
		}

		lazyModFunctions.push(
			[addGetDataFunction, arrowFunctionCollection, settings],
			[findReturnStatements, arrowFunctionCollection, settings],
			[
				addCommentOnFunctionDeclaration,
				arrowFunctionCollection,
				settings,
			],
			[
				findComponentFunctionDefinition,
				root,
				{ name: '', includeParams: settings.includeParams },
			],
		);
	});

	return [false, lazyModFunctions];
};

export const findGetStaticPathsFunctionDeclarations: ModFunction<
	File,
	'read'
> = (j, root, settings) => {
	const lazyModFunctions: LazyModFunction[] = [];

	root.find(j.FunctionDeclaration, {
		id: {
			type: 'Identifier',
			name: 'getStaticPaths',
		},
	}).forEach((functionDeclarationPath) => {
		const functionDeclarationCollection = j(functionDeclarationPath);

		const newSettings = { ...settings, methodName: 'getStaticPaths' };

		lazyModFunctions.push(
			[findReturnStatements, functionDeclarationCollection, newSettings],
			[addGenerateStaticParamsFunctionDeclaration, root, newSettings],
			[addPageParamsTypeAlias, root, newSettings],
			[
				addCommentOnFunctionDeclaration,
				functionDeclarationCollection,
				newSettings,
			],
		);
	});

	return [false, lazyModFunctions];
};

export const findGetStaticPathsArrowFunctions: ModFunction<File, 'read'> = (
	j,
	root,
	settings,
) => {
	const lazyModFunctions: LazyModFunction[] = [];

	const arrowFunctionCollection = root
		.find(j.VariableDeclarator, {
			id: {
				type: 'Identifier',
				name: 'getStaticPaths',
			},
		})
		.find(j.ArrowFunctionExpression);

	arrowFunctionCollection.forEach((arrowFunctionPath) => {
		const arrowFunctionCollection = j(arrowFunctionPath);

		// only direct child of variableDeclarator
		if (arrowFunctionPath.parent?.value?.id?.name !== 'getStaticPaths') {
			return;
		}

		const newSettings = { ...settings, methodName: 'getStaticPaths' };

		lazyModFunctions.push(
			[findReturnStatements, arrowFunctionCollection, newSettings],
			[addGenerateStaticParamsFunctionDeclaration, root, newSettings],
			[addPageParamsTypeAlias, root, newSettings],
			[
				addCommentOnFunctionDeclaration,
				arrowFunctionCollection,
				newSettings,
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

		if (settings.methodName === 'getStaticPaths') {
			lazyModFunctions.push([
				findFallbackObjectProperty,
				returnStatementCollection,
				settings,
			]);

			return;
		}

		lazyModFunctions.push([
			findRevalidateObjectProperty,
			returnStatementCollection,
			settings,
		]);
	});

	return [false, lazyModFunctions];
};

/**
 * {
 *  fallback: boolean | 'blocking';
 * }
 */
export const findFallbackObjectProperty: ModFunction<any, 'read'> = (
	j,
	root,
) => {
	const lazyModFunctions: LazyModFunction[] = [];

	const fileCollection = root.closest(j.File);

	root.find(j.ObjectProperty, {
		key: {
			type: 'Identifier',
			name: 'fallback',
		},
	}).forEach((objectPropertyPath) => {
		const objectPropertyValue = objectPropertyPath.value.value;

		if (
			objectPropertyValue.type !== 'BooleanLiteral' &&
			!(
				objectPropertyValue.type === 'StringLiteral' &&
				objectPropertyValue.value === 'blocking'
			)
		) {
			return;
		}

		const fallback = objectPropertyValue.value;

		lazyModFunctions.push([
			addFallbackVariableDeclaration,
			fileCollection,
			{ fallback },
		]);
	});

	return [false, lazyModFunctions];
};

/**
 * export const dynamicParams = true;
 */
export const addFallbackVariableDeclaration: ModFunction<any, 'write'> = (
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
							name: 'dynamicParams',
						},
					},
				],
			},
		})?.length !== 0;

	if (exportNamedDeclarationAlreadyExists) {
		return [false, []];
	}

	const dynamicParams =
		settings.fallback === true || settings.fallback === 'blocking';

	const exportNamedDeclaration = j.exportNamedDeclaration(
		j.variableDeclaration('const', [
			j.variableDeclarator(
				j.identifier('dynamicParams'),
				j.booleanLiteral(dynamicParams),
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

export const findRevalidateObjectProperty: ModFunction<any, 'read'> = (
	j,
	root,
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

	const revalidate = parseInt(String(settings.revalidate) ?? '0', 10);

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

export const addGetXFunctionDefinition: ModFunction<File, 'write'> = (
	j,
	root,
	settings,
) => {
	const name = 'name' in settings ? String(settings.name) ?? '' : '';

	const params = [];

	if (settings.includeParams) {
		params.push(serverHookParamsFactory(j));
	}

	const identifierName = name
		.split('')
		.map((character, i) => (i == 0 ? character.toUpperCase() : character))
		.join('');

	const functionDeclaration = j.functionDeclaration.from({
		async: true,
		body: j.blockStatement([]),
		id: j.identifier(`get${identifierName}`),
		comments: [j.commentLine(' TODO: implement this function')],
		params,
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

		lazyModFunctions.push([
			findObjectPatternsWithFunctionDeclaration,
			functionDeclarationCollection,
			settings,
		]);
	});

	return [false, lazyModFunctions];
};

export const addVariableDeclarations: ModFunction<
	FunctionDeclaration,
	'write'
> = (j, root, settings) => {
	const names =
		'names' in settings ? String(settings.names).split(',') ?? [] : [];

	const params = settings.includeParams ? [j.identifier('params')] : [];

	const variableDeclaration = j.variableDeclaration('const', [
		j.variableDeclarator(
			j.objectPattern(
				names.map((name) =>
					j.objectProperty.from({
						shorthand: true,
						value: j.identifier(name),
						key: j.identifier(name),
					}),
				),
			),
			j.awaitExpression(
				j.callExpression(j.identifier(`getData`), params),
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
	root.forEach((objectPatternPath) => {
		const paramsProperty = root.find(j.ObjectProperty, {
			key: {
				type: 'Identifier',
				name: 'params',
			},
		});
		if (paramsProperty.length === 0 && settings.includeParams) {
			const props = objectPatternPath.value.properties;

			const newProperty = j.property.from({
				kind: 'init',
				key: j.identifier('params'),
				shorthand: true,
				value: j.identifier('params'),
			});

			props.push(newProperty);

			root.forEach((rootPath) => {
				rootPath.value.typeAnnotation = j.tsTypeAnnotation(
					j.tsTypeReference(j.identifier('PageProps')),
				);
			});
		}
	});

	const objectPropertyCollection = root.find(j.ObjectProperty, {
		key: {
			type: 'Identifier',
		},
	});

	const propsToBeMovedToComponent: ObjectProperty[] = [];

	objectPropertyCollection.forEach((objectPropertyPath) => {
		if (
			objectPropertyPath.value.key.type === 'Identifier' &&
			!['params', 'searchParams'].includes(
				objectPropertyPath.value.key.name,
			)
		) {
			propsToBeMovedToComponent.push(objectPropertyPath.value);
		}
	});

	const lazyModFunctions: LazyModFunction[] = [];

	const updatedSettings = {
		...settings,
		names: propsToBeMovedToComponent
			.map((prop) => ('name' in prop.key ? prop.key.name : ''))
			.join(),
	};

	lazyModFunctions.push([
		addVariableDeclarations,
		root.closest(j.FunctionDeclaration),
		updatedSettings,
	]);

	lazyModFunctions.push([
		removeCollection,
		objectPropertyCollection,
		settings,
	]);

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

	const hasGetStaticPathsMethod =
		root.find(j.FunctionDeclaration, {
			id: {
				type: 'Identifier',
				name: 'getStaticPaths',
			},
		}).length !== 0;

	const settings = {
		includeParams: hasGetStaticPathsMethod,
	};

	const lazyModFunctions: LazyModFunction[] = [
		[findGetStaticPropsFunctionDeclarations, root, settings],
		[findGetStaticPropsArrowFunctions, root, settings],
		[findGetServerSidePropsFunctionDeclarations, root, settings],
		[findGetServerSidePropsArrowFunctions, root, settings],
		[findGetStaticPathsFunctionDeclarations, root, settings],
		[findGetStaticPathsArrowFunctions, root, settings],
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
