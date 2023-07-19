import {
	API,
	ArrowFunctionExpression,
	Collection,
	File,
	FileInfo,
	FunctionDeclaration,
	JSCodeshift,
	ObjectPattern,
	ObjectProperty,
	Options,
	Transform,
} from 'jscodeshift';

type Settings = Partial<Record<string, string | boolean | Collection<any>>>;

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

const findLastIndex = <T>(
	array: Array<T>,
	predicate: (value: T, index: number, obj: T[]) => boolean,
): number => {
	let l = array.length;
	while (l--) {
		if (predicate(array[l]!, l, array)) return l;
	}
	return -1;
};

const getFirstIndexAfterImports = (j: JSCodeshift, file: Collection<File>) => {
	const programBody = file.find(j.Program).paths()[0]?.value.body ?? [];

	const lastImportDeclarationIndex = findLastIndex(programBody, (node) =>
		j.ImportDeclaration.check(node),
	);

	return lastImportDeclarationIndex === -1
		? 0
		: lastImportDeclarationIndex + 1;
};

/**
 * factories
 */

const generateStaticParamsMethodFactory = (j: JSCodeshift) => {
	const functionDeclaration = j(`async function generateStaticParams() {
		return (await getStaticPaths({})).paths;
	}`)
		.find(j.FunctionDeclaration)
		.paths()[0]!;

	return j.exportNamedDeclaration(functionDeclaration.value);
};

const getDataMethodFactory = (
	j: JSCodeshift,
	argType: string,
	decoratedMethodName: string,
) => {
	return j(`
	async function getData(ctx: ${argType}) {
		return (await ${decoratedMethodName}(ctx)).props;
	}`)
		.find(j.FunctionDeclaration)
		.paths()[0]!;
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
		const insertPosition = getFirstIndexAfterImports(j, root);

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
		const insertPosition = getFirstIndexAfterImports(j, root);

		program.value.body.splice(
			insertPosition,
			0,
			...[pageParamsType, pagePropsType],
		);
	});

	return [true, []];
};

const addImportStatement: ModFunction<File, 'write'> = (j, root, settings) => {
	if (typeof settings.statement !== 'string') {
		return [false, []];
	}

	const alreadyExists =
		root.find(j.ImportDeclaration, {
			specifiers: [
				{
					type: 'ImportSpecifier',
					imported: {
						type: 'Identifier',
						name: settings.statement,
					},
				},
			],
			source: {
				type: 'StringLiteral',
				value: 'next',
			},
		}).length !== 0;

	if (alreadyExists) {
		return [false, []];
	}

	const importSpecifier = j.importSpecifier(j.identifier(settings.statement));

	const importDeclaration = j.importDeclaration(
		[importSpecifier],
		j.literal('next'),
	);

	root.find(j.Program).get('body', 0).insertBefore(importDeclaration);

	return [false, []];
};

const addGetDataFunction: ModFunction<
	FunctionDeclaration | ArrowFunctionExpression,
	'write'
> = (j, root, settings) => {
	const { methodName } = settings;

	const contextTypeName =
		methodName === 'getStaticProps'
			? 'GetStaticPropsContext'
			: 'GetServerSidePropsContext';

	const getDataFunctionDeclaration = getDataMethodFactory(
		j,
		contextTypeName,
		`${methodName}`,
	);

	const file = root.closest(j.File);
	const program = root.closest(j.Program);

	const programNode = program.paths()[0] ?? null;

	if (programNode === null) {
		return [false, []];
	}

	programNode.value.body.splice(
		getFirstIndexAfterImports(j, file),
		0,
		getDataFunctionDeclaration.value,
	);

	return [true, [[addImportStatement, file, { statement: contextTypeName }]]];
};

// @TODO fix code duplication
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
			[
				addGetDataFunction,
				functionDeclarationCollection,
				{ ...settings, methodName: 'getStaticProps' },
			],
			[findReturnStatements, functionDeclarationCollection, settings],
			[
				findComponentFunctionDefinition,
				root,
				{ name: '', includeParams: settings.includeParams },
			],
		);
	});

	return [false, lazyModFunctions];
};

// @TODO fix code duplication
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
			return [false, []];
		}

		lazyModFunctions.push(
			[
				addGetDataFunction,
				arrowFunctionCollection,
				{ ...settings, methodName: 'getStaticProps' },
			],
			[findReturnStatements, arrowFunctionCollection, settings],
			[
				findComponentFunctionDefinition,
				root,
				{ name: '', includeParams: settings.includeParams },
			],
		);
	});

	return [false, lazyModFunctions];
};

// @TODO fix code duplication
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
			[
				addGetDataFunction,
				functionDeclarationCollection,
				{ ...settings, methodName: 'getServerSideProps' },
			],
			[findReturnStatements, functionDeclarationCollection, settings],
			[
				findComponentFunctionDefinition,
				root,
				{ name: '', includeParams: settings.includeParams },
			],
		);
	});

	return [false, lazyModFunctions];
};

// @TODO fix code duplication
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
			return [false, []];
		}

		lazyModFunctions.push(
			[
				addGetDataFunction,
				arrowFunctionCollection,
				{ ...settings, methodName: 'getServerSideProps' },
			],
			[findReturnStatements, arrowFunctionCollection, settings],
			[
				findComponentFunctionDefinition,
				root,
				{ name: '', includeParams: settings.includeParams },
			],
		);
	});

	return [false, lazyModFunctions];
};

// @TODO fix code duplication
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
		);
	});

	return [false, lazyModFunctions];
};
// @TODO fix code duplication
export const findGetStaticPathsArrowFunctions: ModFunction<File, 'read'> = (
	j,
	root,
	settings,
) => {
	const lazyModFunctions: LazyModFunction[] = [];

	const variableDeclaratorCollection = root.find(j.VariableDeclarator, {
		id: {
			type: 'Identifier',
			name: 'getStaticPaths',
		},
	});

	const arrowFunctionCollection = variableDeclaratorCollection.find(
		j.ArrowFunctionExpression,
	);

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
		);
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

export const findComponentFunctionDefinition: ModFunction<File, 'read'> = (
	j,
	root,
	settings,
) => {
	const lazyModFunctions: LazyModFunction[] = [];

	const program = root.find(j.Program).paths()[0] ?? null;

	if (program === null) {
		return [false, []];
	}

	const defaultExport =
		root.find(j.ExportDefaultDeclaration).paths()[0] ?? null;
	const defaultExportDeclaration = defaultExport?.value.declaration ?? null;

	let pageComponentFunction:
		| FunctionDeclaration
		| ArrowFunctionExpression
		| null = null;

	if (defaultExportDeclaration?.type === 'FunctionDeclaration') {
		pageComponentFunction = defaultExportDeclaration;
	}

	if (defaultExportDeclaration?.type === 'Identifier') {
		const program = root.find(j.Program).paths()[0] ?? null;

		(program?.value.body ?? []).forEach((node) => {
			if (
				node.type === 'FunctionDeclaration' &&
				node.id?.name === defaultExportDeclaration.name
			) {
				pageComponentFunction = node;
			}

			if (
				node.type === 'VariableDeclaration' &&
				node.declarations[0]?.type === 'VariableDeclarator' &&
				node.declarations[0].id?.type === 'Identifier' &&
				node.declarations[0].id.name ===
					defaultExportDeclaration.name &&
				node.declarations[0].init?.type === 'ArrowFunctionExpression'
			) {
				pageComponentFunction = node.declarations[0].init;
			}
		});
	}

	if (pageComponentFunction === null) {
		return [false, []];
	}

	lazyModFunctions.push([
		findObjectPatternsWithFunctionParameters,
		j(pageComponentFunction),
		settings,
	]);

	lazyModFunctions.push([
		findIdentifierWithFunctionParameters,
		j(pageComponentFunction),
		settings,
	]);

	return [false, lazyModFunctions];
};

export const addVariableDeclarations: ModFunction<ObjectProperty, 'write'> = (
	j,
	root,
	settings,
) => {
	const objectExpression = j.objectExpression([
		j.objectProperty.from({
			key: j.identifier('params'),
			value: j.identifier('params'),
			shorthand: true,
		}),
	]);

	const objectProperties: ObjectProperty[] = [];

	root.forEach((objectPropertyPath) => {
		objectProperties.push(
			j.objectProperty.from({
				...objectPropertyPath.value,
				shorthand: true,
			}),
		);
	});

	const variableDeclaration = j.variableDeclaration('const', [
		j.variableDeclarator(
			j.objectPattern(objectProperties),
			j.awaitExpression(
				j.callExpression(j.identifier(`getData`), [objectExpression]),
			),
		),
	]);

	const functionDeclaration = settings.component as Collection<
		FunctionDeclaration | ArrowFunctionExpression
	>;

	functionDeclaration.forEach((path) => {
		const { body } = path.value;

		if (j.JSXElement.check(body)) {
			path.value.body = j.blockStatement.from({
				body: [variableDeclaration, j.returnStatement(body)],
			});
			path.value.async = true;
		}

		if (j.BlockStatement.check(body)) {
			body.body.unshift(variableDeclaration);
			path.value.async = true;
		}
	});

	return [true, []];
};

export const findIdentifierWithFunctionParameters: ModFunction<
	FunctionDeclaration,
	'read'
> = (j, root) => {
	const lazyModFunctions: LazyModFunction[] = [];

	root.forEach((functionDeclarationPath) => {
		const firstParam = functionDeclarationPath.value.params[0] ?? null;

		if (j.Identifier.check(firstParam)) {
			lazyModFunctions.push([
				addGetDataVariableDeclaration,
				root,
				{ identifierName: firstParam.name },
			]);
		}
	});

	return [false, lazyModFunctions];
};

const addGetDataVariableDeclaration: ModFunction<
	FunctionDeclaration | ArrowFunctionExpression,
	'write'
> = (j, root, settings) => {
	const objectExpression = j.objectExpression([
		j.objectProperty.from({
			key: j.identifier('params'),
			value: j.identifier('params'),
			shorthand: true,
		}),
	]);

	const variableDeclaration = j.variableDeclaration('const', [
		j.variableDeclarator(
			j.identifier(settings.identifierName?.toString() ?? ''),
			j.awaitExpression(
				j.callExpression(j.identifier(`getData`), [objectExpression]),
			),
		),
	]);

	root.forEach((path) => {
		const { body } = path.value;

		if (j.JSXElement.check(body)) {
			path.value.body = j.blockStatement.from({
				body: [variableDeclaration, j.returnStatement(body)],
			});
		}

		if (j.BlockStatement.check(body)) {
			body.body.unshift(variableDeclaration);
		}
	});

	return [false, []];
};

export const findObjectPatternsWithFunctionParameters: ModFunction<
	FunctionDeclaration,
	'read'
> = (j, root, settings) => {
	const lazyModFunctions: LazyModFunction[] = [];

	root.find(j.ObjectPattern)
		.filter(
			(path) =>
				(path.parentPath.node.type === 'FunctionDeclaration' ||
					path.parentPath.node.type === 'ArrowFunctionExpression') &&
				path.parentPath.name === 'params',
		)
		.forEach((objectPatternPath) => {
			const objectPatternCollection = j(objectPatternPath);

			lazyModFunctions.push([
				findObjectPropertiesWithinFunctionParameters,
				objectPatternCollection,
				{ ...settings, component: root },
			]);
		});

	return [false, lazyModFunctions];
};

// @TODO
function deepCopyObjectPattern(j: JSCodeshift, objectPattern: ObjectPattern) {
	const newObjectPattern = j.objectPattern([]);

	objectPattern.properties.forEach((property) => {
		if (!('value' in property)) {
			return;
		}

		if (property.value.type === 'ObjectPattern') {
			const newValue = deepCopyObjectPattern(j, property.value);

			newObjectPattern.properties.push(
				j.objectProperty.from({
					key: property.key,
					value: newValue,
					shorthand: true,
				}),
			);

			return;
		}

		newObjectPattern.properties.push(
			j.objectProperty.from({
				key: property.key,
				value: property.value,
				shorthand: true,
			}),
		);
	});

	return newObjectPattern;
}
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

		if (paramsProperty.length === 0) {
			const props = objectPatternPath.value.properties;

			const newProperty = j.property.from({
				kind: 'init',
				key: j.identifier('params'),
				shorthand: true,
				value: j.identifier('params'),
			});

			props.push(newProperty);

			// root.forEach((rootPath) => {
			// 	rootPath.value.typeAnnotation = j.tsTypeAnnotation(
			// 		j.tsTypeReference(j.identifier('PageProps')),
			// 	);
			// });
		}
	});

	const objectPropertyCollection = root.find(j.ObjectProperty, {
		key: {
			type: 'Identifier',
		},
	});

	const lazyModFunctions: LazyModFunction[] = [];

	const objectPattern = root.paths()[0] ?? null;

	if (!objectPattern) {
		return [false, []];
	}

	const clonedObjectPattern = deepCopyObjectPattern(j, objectPattern.value);

	const properties = clonedObjectPattern.properties.filter(
		(p) =>
			p.type === 'ObjectProperty' &&
			p.key.type === 'Identifier' &&
			!['params', 'searchParams'].includes(p.key.name),
	);

	lazyModFunctions.push([addVariableDeclarations, j(properties), settings]);

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
