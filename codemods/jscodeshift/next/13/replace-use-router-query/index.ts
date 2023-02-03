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
	SpreadElement,
	ObjectExpression,
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

const findCallExpressionsWithMemberExpression =
	(calleeObjectName: string, calleePropertyName: string) =>
	(j: JSCodeshift, root: Collection<any>): Collection<CallExpression> => {
		return root.find(j.CallExpression, {
			callee: {
				type: 'MemberExpression',
				object: {
					type: 'Identifier',
					name: 'searchParams',
				},
				property: {
					type: 'Identifier',
					name: 'get',
				},
			},
		});
	};

const findMemberExpressions =
	(objectName: string, propertyName: string | undefined) =>
	(j: JSCodeshift, root: Collection<any>): Collection<MemberExpression> => {
		type FilterType = Parameters<
			typeof root.find<MemberExpression>
		>[1] & {};

		const filter: FilterType = {
			object: {
				type: 'Identifier' as const,
				name: objectName,
			},
			property: {
				type: 'Identifier' as const,
			},
		};

		if (propertyName) {
			filter.property = {
				type: 'Identifier' as const,
				name: propertyName,
			};
		}

		return root.find(j.MemberExpression, filter);
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

const findSpreadElements =
	(argumentObjectName: string, argumentPropertyQuery: string) =>
	(j: JSCodeshift, root: Collection<any>): Collection<SpreadElement> => {
		return root.find(j.SpreadElement, {
			argument: {
				type: 'MemberExpression',
				object: {
					type: 'Identifier',
					name: argumentObjectName,
				},
				property: {
					type: 'Identifier',
					name: argumentPropertyQuery,
				},
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

export const transformTripleDotReplaceRouterQueryWithSearchParams: IntuitaTransform =
	(j, root): void => {
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
				findSpreadElements(routerName, 'query')(
					j,
					blockStatement,
				).replaceWith(() => {
					return j.spreadElement(
						j.callExpression(
							j.memberExpression(
								j.identifier('searchParams'),
								j.identifier('entries'),
								false,
							),
							[],
						),
					);
				});
			}
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
			).replaceWith(() => j.identifier('searchParams'));
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
	).replaceWith(() => j.callExpression(j.identifier('useSearchParams'), []));
};

export const transformReplaceSearchParamsXWithSearchParamsGetX: IntuitaTransform =
	(j, root): void => {
		const importDeclarations = findImportDeclarations(
			'useSearchParams',
			'next/navigation',
		)(j, root);

		if (importDeclarations.size() === 0) {
			return;
		}

		const variableNames: string[] = [];

		findVariableDeclaratorWithCallExpression('useSearchParams')(
			j,
			root,
		).forEach((variableDeclaratorPath) => {
			const { id } = variableDeclaratorPath.node;

			if (id.type !== 'Identifier') {
				return;
			}

			variableNames.push(id.name);
		});

		for (const variableName of variableNames) {
			findMemberExpressions(variableName, undefined)(j, root).replaceWith(
				(memberExpressionPath) => {
					const { property } = memberExpressionPath.node;

					if (
						property.type !== 'Identifier' ||
						property.name === 'entries'
					) {
						return memberExpressionPath.node;
					}

					return j.callExpression(
						j.memberExpression(
							j.identifier('searchParams'),
							j.identifier('get'),
							false,
						),
						[memberExpressionPath.node.property],
					);
				},
			);
		}
	};

export const transformReplaceUseMemoSecondArgumentWithSearchParams: IntuitaTransform =
	(j, root): void => {
		const importDeclarations = findImportDeclarations(
			'useSearchParams',
			'next/navigation',
		)(j, root);

		if (importDeclarations.size() === 0) {
			return;
		}

		root.find(j.BlockStatement).forEach((blockStatementPath) => {
			const blockStatement = j(blockStatementPath);

			const variableNames: string[] = [];

			findVariableDeclaratorWithCallExpression('useSearchParams')(
				j,
				blockStatement,
			).forEach((variableDeclaratorPath) => {
				const { id } = variableDeclaratorPath.node;

				if (id.type !== 'Identifier') {
					return;
				}

				variableNames.push(id.name);
			});

			const hadSearchParamsGetsPerCall: boolean[] = [];

			findCallExpressions('useMemo')(j, blockStatement).forEach(
				(callExpressionPath, i) => {
					const { arguments: args } = callExpressionPath.value;

					if (!args[1]) {
						return;
					}

					const dependencyArguments = j(args[1]);

					let hadSearchParamsGets = false;

					for (const variableName of variableNames) {
						findCallExpressionsWithMemberExpression(
							variableName,
							'get',
						)(j, dependencyArguments)
							.forEach(() => {
								hadSearchParamsGets = true;
							})
							.remove();
					}

					hadSearchParamsGetsPerCall[i] = hadSearchParamsGets;
				},
			);

			console.log(hadSearchParamsGetsPerCall);

			findCallExpressions('useMemo')(j, blockStatement)
				.filter((_, i) => {
					return hadSearchParamsGetsPerCall[i] ?? false;
				})
				.replaceWith((callExpression) => {
					const { arguments: arg } = callExpression.node;

					if (
						!arg[0] ||
						!arg[1] ||
						arg[1].type !== 'ArrayExpression'
					) {
						return callExpression.node;
					}

					return j.callExpression(callExpression.node.callee, [
						arg[0],
						j.arrayExpression([
							...variableNames.map((variableName) =>
								j.identifier(variableName),
							),
							...arg[1].elements,
						]),
					]);
				});
		});
	};

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	const transforms: IntuitaTransform[] = [
		transformAddUseSearchParamsImport,
		transformAddSearchParamsVariableDeclarator,
		transformTripleDotReplaceRouterQueryWithSearchParams,
		transformReplaceRouterQueryWithSearchParams,
		transformUseRouterQueryWithUseSearchParams,
		transformReplaceSearchParamsXWithSearchParamsGetX,
		transformReplaceUseMemoSecondArgumentWithSearchParams,
	];

	const j = api.jscodeshift;
	const root = j(file.source);

	for (const intuitaTransform of transforms) {
		intuitaTransform(j, root);
	}

	return root.toSource();
}
