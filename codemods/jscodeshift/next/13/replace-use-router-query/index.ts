import {
	API,
	Collection,
	FileInfo,
	Options,
	JSCodeshift,
	ImportDeclaration,
	VariableDeclarator,
	MemberExpression,
	CallExpression,
} from 'jscodeshift';

type IntuitaTransform = (j: API['jscodeshift'], root: Collection<any>) => void;

const findImportDeclarations =
	(importedName: string, sourceValue: string) =>
	(j: JSCodeshift, root: Collection<any>): Collection<ImportDeclaration> => {
		return root.find(j.ImportDeclaration, {
			specifiers: [
				{
					imported: {
						type: 'Identifier',
						name: importedName,
					},
				},
			],
			source: {
				value: sourceValue,
			},
		});
	};

const findVariableDeclaratorWithCallExpression =
	(calleeName: string) =>
	(j: JSCodeshift, root: Collection<any>): Collection<VariableDeclarator> => {
		return root.find(j.VariableDeclarator, {
			init: {
				type: 'CallExpression',
				callee: {
					type: 'Identifier',
					name: calleeName,
				},
			},
		});
	};

const findMemberExpressionsWithCallExpression =
	(objectCalleeName: string, propertyName: string) =>
	(j: JSCodeshift, root: Collection<any>): Collection<MemberExpression> => {
		return root.find(j.MemberExpression, {
			object: {
				type: 'CallExpression',
				callee: {
					type: 'Identifier',
					name: objectCalleeName,
				},
			},
			property: {
				type: 'Identifier',
				name: propertyName,
			},
		});
	};

const findMemberExpressions =
	(objectName: string, propertyName: string) =>
	(j: JSCodeshift, root: Collection<any>): Collection<MemberExpression> => {
		return root.find(j.MemberExpression, {
			object: {
				type: 'Identifier',
				name: objectName,
			},
			property: {
				type: 'Identifier',
				name: propertyName,
			},
		});
	};

const findVariableDeclaratorWithObjectPatternAndCallExpression =
	(idPropertiesKeyName: string, initCalleeName: string) =>
	(j: JSCodeshift, root: Collection<any>): Collection<VariableDeclarator> => {
		return root.find(j.VariableDeclarator, {
			id: {
				type: 'ObjectPattern',
				properties: [
					{
						type: 'ObjectProperty',
						key: {
							type: 'Identifier',
							name: idPropertiesKeyName,
						},
					},
				],
			},
			init: {
				type: 'CallExpression',
				callee: {
					type: 'Identifier',
					name: initCalleeName,
				},
				arguments: [],
			},
		});
	};

const findCallExpressions =
	(calleeName: string) =>
	(j: JSCodeshift, root: Collection<any>): Collection<CallExpression> => {
		return root.find(j.CallExpression, {
			callee: {
				type: 'Identifier',
				name: calleeName,
			},
		});
	};

export const transformAddUseSearchParamsImport: IntuitaTransform = (
	j: API['jscodeshift'],
	root: Collection<any>,
): void => {
	const importDeclarations = findImportDeclarations(
		'useRouter',
		'next/router',
	)(j, root);

	if (importDeclarations.size() === 0) {
		return;
	}

	let hasQueries = false;

	root.find(j.BlockStatement).forEach((blockStatementPath) => {
		const blockStatement = j(blockStatementPath);

		// 1
		const routerNames: string[] = [];

		findVariableDeclaratorWithCallExpression('useRouter')(
			j,
			blockStatement,
		).forEach((variableDeclaratorPath) => {
			const { id } = variableDeclaratorPath.node;

			if (id.type !== 'Identifier') {
				return;
			}

			routerNames.push(id.name);
		});

		for (const routerName of routerNames) {
			if (
				findMemberExpressions(routerName, 'query')(
					j,
					blockStatement,
				).size() > 0
			) {
				hasQueries = true;
				return;
			}
		}

		// 2
		if (
			findMemberExpressionsWithCallExpression('useRouter', 'query')(
				j,
				blockStatement,
			).size() > 0
		) {
			hasQueries = true;
			return;
		}

		// 3
		if (
			findVariableDeclaratorWithObjectPatternAndCallExpression(
				'query',
				'useRouter',
			)(j, root).size() > 0
		) {
			hasQueries = true;
			return;
		}
	});

	if (!hasQueries) {
		return;
	}

	const importDeclaration = j.importDeclaration(
		[
			j.importSpecifier(
				j.identifier('useSearchParams'),
				j.identifier('useSearchParams'),
			),
		],
		j.stringLiteral('next/navigation'),
	);

	root.find(j.Program).forEach((program) => {
		program.value.body.unshift(importDeclaration);
	});
};

export const transformAddSearchParamsVariableDeclarator: IntuitaTransform = (
	j,
	root,
): void => {
	const importDeclarations = findImportDeclarations(
		'useRouter',
		'next/router',
	)(j, root);

	if (importDeclarations.size() === 0) {
		return;
	}

	root.find(j.BlockStatement).forEach((blockStatementPath) => {
		const blockStatement = j(blockStatementPath);

		if (findCallExpressions('useRouter')(j, blockStatement).size() === 0) {
			return;
		}

		blockStatementPath.node.body.unshift(
			j.variableDeclaration('const', [
				j.variableDeclarator(
					j.identifier('searchParams'),
					j.callExpression(j.identifier('useSearchParams'), []),
				),
			]),
		);
	});
};

export const transformReplaceRouterQueryWithSearchParams: IntuitaTransform = (
	j,
	root,
): void => {
	const importDeclarations = findImportDeclarations(
		'useRouter',
		'next/router',
	)(j, root);

	if (importDeclarations.size() === 0) {
		return;
	}

	root.find(j.BlockStatement).forEach((blockStatementPath) => {
		const blockStatement = j(blockStatementPath);

		const routerNames: string[] = [];

		findVariableDeclaratorWithCallExpression('useRouter')(
			j,
			blockStatement,
		).forEach((variableDeclaratorPath) => {
			const { id } = variableDeclaratorPath.node;

			if (!id || id.type !== 'Identifier') {
				return;
			}

			routerNames.push(id.name);
		});

		for (const routerName of routerNames) {
			findMemberExpressions(routerName, 'query')(
				j,
				blockStatement,
			).replaceWith(() => j.literal('searchParams'));
		}
	});
};

export const transformUseRouterQueryWithUseSearchParams: IntuitaTransform = (
	j,
	root,
): void => {
	const importDeclarations = findImportDeclarations(
		'useRouter',
		'next/router',
	)(j, root);

	if (importDeclarations.size() === 0) {
		return;
	}

	findMemberExpressionsWithCallExpression('useRouter', 'query')(
		j,
		root,
	).replaceWith(() => j.callExpression(j.literal('useSearchParams'), []));

	// root.find(j.BlockStatement).forEach((blockStatementPath) => {
	// 	const blockStatement = j(blockStatementPath);

	// 	// findVariableDeclaratorWithCallExpression('useRouter')(
	// 	// 	j,
	// 	// 	blockStatement,
	// 	// ).forEach((variableDeclaratorPath) => {
	// 	// 	const { id } = variableDeclaratorPath.node;

	// 	// 	if (!id || id.type !== 'Identifier') {
	// 	// 		return;
	// 	// 	}

	// 	// 	routerNames.push(id.name);
	// 	// });

	// 	// for (const routerName of routerNames) {
	// 	// 	findMemberExpressions(routerName, 'query')(
	// 	// 		j,
	// 	// 		blockStatement,
	// 	// 	).replaceWith(() => j.literal('searchParams'));
	// 	// }
	// });
};

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	const transforms: IntuitaTransform[] = [
		transformAddUseSearchParamsImport,
		transformAddSearchParamsVariableDeclarator,
	];

	const j = api.jscodeshift;
	const root = j(file.source);

	for (const intuitaTransform of transforms) {
		intuitaTransform(j, root);
	}

	return root.toSource();
}
