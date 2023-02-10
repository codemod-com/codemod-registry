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
} from 'jscodeshift';

type IntuitaTransform = (j: API['jscodeshift'], root: Collection<any>) => void;
type IntuitaTransformBuilder<T> = (
	options: T,
) => (j: API['jscodeshift'], root: Collection<any>) => void;

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
					name: calleeObjectName,
				},
				property: {
					type: 'Identifier',
					name: calleePropertyName,
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
	(idPropertiesKeyName: string | null, initCalleeName: string) =>
	(j: JSCodeshift, root: Collection<any>): Collection<VariableDeclarator> => {
		const property = idPropertiesKeyName
			? {
					type: 'ObjectProperty' as const,
					key: {
						type: 'Identifier' as const,
						name: idPropertiesKeyName,
					},
			  }
			: undefined;

		const properties = property ? [property] : [];

		return root.find(j.VariableDeclarator, {
			id: {
				type: 'ObjectPattern',
				properties,
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

export const addUseSearchParamsImport: IntuitaTransform = (
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

export const addSearchParamsVariableDeclarator: IntuitaTransform = (
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

export const replaceUseRouterPathnameWithUsePathname: IntuitaTransform = (
	j,
	root,
): void => {
	root.find(j.VariableDeclarator, {
		id: {
			type: 'Identifier',
			name: 'pathname',
		},
		init: {
			type: 'MemberExpression',
			property: {
				type: 'Identifier',
				name: 'pathname',
			},
		},
	}).replaceWith(() => {
		return j.variableDeclarator(
			j.identifier('pathname'),
			j.callExpression(j.identifier('usePathname'), []),
		);
	});
};

export const replaceTripleDotRouterQueryWithSearchParams: IntuitaTransform = (
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

export const replaceRouterQueryWithSearchParams: IntuitaTransform = (
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

export const replaceUseRouterQueryWithUseSearchParams: IntuitaTransform = (
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

export const replaceSearchParamsXWithSearchParamsGetX: IntuitaTransform = (
	j,
	root,
): void => {
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

export const replaceUseMemoSecondArgumentWithSearchParams: IntuitaTransform = (
	j,
	root,
): void => {
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

		findCallExpressions('useMemo')(j, blockStatement)
			.filter((_, i) => {
				return hadSearchParamsGetsPerCall[i] ?? false;
			})
			.replaceWith((callExpression) => {
				const { arguments: arg } = callExpression.node;

				if (!arg[0] || !arg[1] || arg[1].type !== 'ArrayExpression') {
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

export const removeQueryFromDestructuredUseRouterCall: IntuitaTransform = (
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

		findVariableDeclaratorWithObjectPatternAndCallExpression(
			'query',
			'useRouter',
		)(j, blockStatement).forEach((variableDeclaratorPath) => {
			const variableDeclarator = variableDeclaratorPath.value;

			j(variableDeclarator)
				.find(j.ObjectProperty, {
					value: {
						type: 'Identifier',
						name: 'query',
					},
				})
				.remove();
		});
	});
};

export const replaceQueryWithSearchParams: IntuitaTransform = (
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

		blockStatement
			.find(j.Identifier, { name: 'query' })
			.replaceWith(() => j.identifier('searchParams'));
	});
};

export const removeEmptyDestructuring: IntuitaTransform = (j, root): void => {
	root.find(j.BlockStatement).forEach((blockStatementPath) => {
		const blockStatement = j(blockStatementPath);

		blockStatement
			.find(j.VariableDeclarator, {
				id: {
					type: 'ObjectPattern',
				},
			})
			.filter((variableDeclaratorPath) => {
				const variableDeclarator = variableDeclaratorPath.value;

				const { id } = variableDeclarator;

				return (
					id.type === 'ObjectPattern' && id.properties.length === 0
				);
			})
			.remove();
	});
};

export const removeUnusedUseRouterImportSpecifier: IntuitaTransform = (
	j,
	root,
): void => {
	root.find(j.ImportSpecifier)
		.filter((importSpecifierPath) => {
			const importSpecifier = importSpecifierPath.value;

			const hasLocal = Boolean(importSpecifier.local);

			const name =
				importSpecifier.local?.name ?? importSpecifier.imported.name;

			const size = root.find(j.Identifier, { name }).size();

			return size === Number(hasLocal) + 1;
		})
		.remove();
};

export const removeUnusedUseRouterImportDeclaration: IntuitaTransformBuilder<{
	importDeclarationSourceValue: string;
}> =
	({ importDeclarationSourceValue }) =>
	(j, root): void => {
		root.find(j.ImportDeclaration, {
			source: { value: importDeclarationSourceValue },
		})
			.filter((importDeclarationPath) => {
				const importDeclaration = importDeclarationPath.value;

				return (importDeclaration.specifiers?.length ?? 0) === 0;
			})
			.remove();
	};

export const replaceObjectPatternFromSearchParamsWithGetters: IntuitaTransform =
	(j, root): void => {
		root.find(j.BlockStatement).forEach((blockStatementPath) => {
			const blockStatement = j(blockStatementPath);

			const keyValues: [string, string][] = [];

			blockStatement
				.find(j.VariableDeclarator, {
					id: {
						type: 'ObjectPattern',
					},
					init: {
						type: 'Identifier',
						name: 'searchParams',
					},
				})
				.forEach((variableDeclaratorPath) => {
					j(variableDeclaratorPath)
						.find(j.ObjectProperty, {
							key: {
								type: 'Identifier',
							},
							value: {
								type: 'Identifier',
							},
						})
						.forEach((objectPropertyPath) => {
							const { key, value } = objectPropertyPath.value;

							if (
								key.type !== 'Identifier' ||
								value.type !== 'Identifier'
							) {
								return;
							}

							keyValues.push([key.name, value.name]);
						})
						.remove();
				});

			for (const [key, value] of keyValues) {
				blockStatementPath.value.body.push(
					j.variableDeclaration('const', [
						j.variableDeclarator(
							j.identifier(key),
							j.callExpression(
								j.memberExpression(
									j.identifier('searchParams'),
									j.identifier('get'),
									false,
								),
								[j.stringLiteral(value)],
							),
						),
					]),
				);
			}
		});
	};

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	const transforms: IntuitaTransform[] = [
		addUseSearchParamsImport,
		addSearchParamsVariableDeclarator,
		replaceTripleDotRouterQueryWithSearchParams,
		replaceUseRouterPathnameWithUsePathname,
		replaceRouterQueryWithSearchParams,
		replaceUseRouterQueryWithUseSearchParams,
		replaceSearchParamsXWithSearchParamsGetX,
		replaceUseMemoSecondArgumentWithSearchParams,
		removeQueryFromDestructuredUseRouterCall,
		replaceQueryWithSearchParams,
		removeEmptyDestructuring,
		removeUnusedUseRouterImportSpecifier,
		removeUnusedUseRouterImportDeclaration({
			importDeclarationSourceValue: 'next/router',
		}),
		replaceObjectPatternFromSearchParamsWithGetters,
		removeEmptyDestructuring,
	];

	const j = api.jscodeshift;
	const root = j(file.source);

	for (const intuitaTransform of transforms) {
		intuitaTransform(j, root);
	}

	return root.toSource();
}
