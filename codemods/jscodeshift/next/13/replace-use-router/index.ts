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
	Transform,
} from 'jscodeshift';

const buildProxy = <T extends object>(obj: T, onDirty: () => void) => {
	let dirtyFlag = false;

	return new Proxy(obj, {
		get(target, prop, receiver) {
			if (prop === 'replace' || prop === 'insertAfter') {
				if (!dirtyFlag) {
					dirtyFlag = true;
					onDirty();
				}
			}
			return Reflect.get(target, prop, receiver);
		},
	});
};

type IntuitaTransform = (
	j: API['jscodeshift'],
	root: Collection<any>,
) => boolean;

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

export const addUseSearchParamsImport: IntuitaTransform = (j, root) => {
	const importDeclarations = findImportDeclarations(
		'useRouter',
		'next/router',
	)(j, root);

	if (importDeclarations.size() === 0) {
		return false;
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
		return false;
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

	return true;
};

export const addSearchParamsVariableDeclarator: IntuitaTransform = (
	j,
	root,
) => {
	const importDeclarations = findImportDeclarations(
		'useRouter',
		'next/router',
	)(j, root);

	if (importDeclarations.size() === 0) {
		return false;
	}

	let dirtyFlag = false;

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

		dirtyFlag = true;
	});

	return dirtyFlag;
};

export const replaceUseRouterPathnameWithUsePathname: IntuitaTransform = (
	j,
	root,
) => {
	let dirtyFlag = false;

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
		dirtyFlag = true;

		return j.variableDeclarator(
			j.identifier('pathname'),
			j.callExpression(j.identifier('usePathname'), []),
		);
	});

	return dirtyFlag;
};

export const replaceTripleDotRouterQueryWithSearchParams: IntuitaTransform = (
	j,
	root,
) => {
	const importDeclarations = findImportDeclarations(
		'useRouter',
		'next/router',
	)(j, root);

	if (importDeclarations.size() === 0) {
		return false;
	}

	let dirtyFlag = false;

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
				dirtyFlag = true;

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

	return dirtyFlag;
};

export const replaceRouterQueryWithSearchParams: IntuitaTransform = (
	j,
	root,
) => {
	const importDeclarations = findImportDeclarations(
		'useRouter',
		'next/router',
	)(j, root);

	if (importDeclarations.size() === 0) {
		return false;
	}

	let dirtyFlag = false;

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
			).replaceWith(() => {
				dirtyFlag = true;

				j.identifier('searchParams');
			});
		}
	});

	return dirtyFlag;
};

export const replaceUseRouterQueryWithUseSearchParams: IntuitaTransform = (
	j,
	root,
) => {
	const importDeclarations = findImportDeclarations(
		'useRouter',
		'next/router',
	)(j, root);

	if (importDeclarations.size() === 0) {
		return false;
	}

	let dirtyFlag = false;

	findMemberExpressionsWithCallExpression('useRouter', 'query')(
		j,
		root,
	).replaceWith(() => {
		dirtyFlag = true;

		j.callExpression(j.identifier('useSearchParams'), []);
	});

	return dirtyFlag;
};

export const replaceSearchParamsXWithSearchParamsGetX: IntuitaTransform = (
	j,
	root,
) => {
	const importDeclarations = findImportDeclarations(
		'useSearchParams',
		'next/navigation',
	)(j, root);

	if (importDeclarations.size() === 0) {
		return false;
	}

	let dirtyFlag = false;

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

				dirtyFlag = true;

				return j.callExpression(
					j.memberExpression(
						j.identifier('searchParams'),
						j.identifier('get'),
						false,
					),
					[j.stringLiteral(property.name)],
				);
			},
		);
	}

	return dirtyFlag;
};

export const replaceUseMemoSecondArgumentWithSearchParams: IntuitaTransform = (
	j,
	root,
) => {
	const importDeclarations = findImportDeclarations(
		'useSearchParams',
		'next/navigation',
	)(j, root);

	if (importDeclarations.size() === 0) {
		return false;
	}

	let dirtyFlag = false;

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
							dirtyFlag = true;
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

				dirtyFlag = true;

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

	return dirtyFlag;
};

export const removeQueryFromDestructuredUseRouterCall: IntuitaTransform = (
	j,
	root,
) => {
	const importDeclarations = findImportDeclarations(
		'useRouter',
		'next/router',
	)(j, root);

	if (importDeclarations.size() === 0) {
		return false;
	}

	let dirtyFlag = false;

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
				.forEach(() => {
					dirtyFlag = true;
				})
				.remove();
		});
	});

	return dirtyFlag;
};

export const replaceQueryWithSearchParams: IntuitaTransform = (j, root) => {
	const importDeclarations = findImportDeclarations(
		'useRouter',
		'next/router',
	)(j, root);

	if (importDeclarations.size() === 0) {
		return false;
	}

	let dirtyFlag = false;

	root.find(j.BlockStatement).forEach((blockStatementPath) => {
		const blockStatement = j(blockStatementPath);

		blockStatement.find(j.Identifier, { name: 'query' }).replaceWith(() => {
			dirtyFlag = true;

			return j.identifier('searchParams');
		});
	});

	return dirtyFlag;
};

export const removeEmptyDestructuring: IntuitaTransform = (j, root) => {
	let dirtyFlag = false;

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
			.forEach(() => {
				dirtyFlag = true;
			})
			.remove();
	});

	return dirtyFlag;
};

export const removeUnusedImportSpecifier: IntuitaTransform = (j, root) => {
	let dirtyFlag = false;

	root.find(j.ImportSpecifier)
		.filter((importSpecifierPath) => {
			const importSpecifier = importSpecifierPath.value;

			const hasLocal = Boolean(importSpecifier.local);

			const name =
				importSpecifier.local?.name ?? importSpecifier.imported.name;

			const size = root.find(j.Identifier, { name }).size();

			return size === Number(hasLocal) + 1;
		})
		.forEach(() => {
			dirtyFlag = true;
		})
		.remove();

	return dirtyFlag;
};

export const removeUnusedImportDeclaration: IntuitaTransform = (
	j,
	root,
): void => {
	root.find(j.ImportDeclaration)
		.filter((importDeclarationPath) => {
			const importDeclaration = importDeclarationPath.value;

			const sourceIsCss =
				importDeclaration.source.type === 'StringLiteral' &&
				importDeclaration.source.value.endsWith('.css');

			return (
				(importDeclaration.specifiers?.length ?? 0) === 0 &&
				!sourceIsCss
			);
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

export const replaceDestructedPathnameWithUsePathname: IntuitaTransform = (
	j,
	root,
): void => {
	type DirtyFlag = 'variableDeclaration' | 'propertyPath';

	const PATHNAME = 'pathname';
	const USE_PATHNAME = 'usePathname';

	let dirtyFlags = new Set<DirtyFlag>();

	const buildOnDirty = (value: DirtyFlag) => () => {
		dirtyFlags.add(value);
	};

	root.find(j.VariableDeclaration).forEach((variableDeclarationPath) => {
		const variableDeclaration = buildProxy(
			variableDeclarationPath,
			buildOnDirty('variableDeclaration'),
		);

		let valueName: string | null = null;

		j(variableDeclaration)
			.find(j.ObjectPattern)
			.forEach((objectPatternPath) => {
				j(objectPatternPath)
					.find(j.ObjectProperty)
					.forEach((objectPropertyPath) => {
						const propertyPathProxy = buildProxy(
							objectPropertyPath,
							buildOnDirty('propertyPath'),
						);

						const { key, value } = propertyPathProxy.value;

						if (
							key.type === 'Identifier' &&
							value.type === 'Identifier' &&
							key.name === PATHNAME
						) {
							valueName = value.name;

							propertyPathProxy.replace();
						}
					});
			});

		if (dirtyFlags.has('propertyPath') && valueName) {
			variableDeclaration.insertAfter(
				j.variableDeclaration('const', [
					j.variableDeclarator(
						j.identifier(valueName),
						j.callExpression(j.identifier(USE_PATHNAME), []),
					),
				]),
			);
		}
	});
};

export const replaceRouterIsReadyWithTrue: IntuitaTransform = (
	j,
	root,
): void => {
	root.find(j.MemberExpression, {
		object: {
			type: 'Identifier',
			name: 'router',
		},
		property: {
			type: 'Identifier',
			name: 'isReady',
		},
	}).replaceWith(() => {
		return j.booleanLiteral(true);
	});

	root.find(j.MemberExpression, {
		object: {
			type: 'CallExpression',
			callee: {
				type: 'Identifier',
				name: 'useRouter',
			},
		},
		property: {
			type: 'Identifier',
			name: 'isReady',
		},
	}).replaceWith(() => {
		return j.booleanLiteral(true);
	});

	/** blocks */

	root.find(j.BlockStatement).forEach((blockStatementPath) => {
		const names: string[] = [];

		j(blockStatementPath)
			.find(j.VariableDeclarator, {
				init: {
					type: 'CallExpression',
					callee: {
						type: 'Identifier',
						name: 'useRouter',
					},
				},
			})
			.forEach((variableDeclaratorPath) => {
				j(variableDeclaratorPath)
					.find(j.ObjectPattern)
					.forEach((objectPatternPath) => {
						j(objectPatternPath)
							.find(j.ObjectProperty)
							.forEach((propertyPath) => {
								const { key, value } = propertyPath.node;

								if (
									key.type === 'Identifier' &&
									value.type === 'Identifier' &&
									key.name === 'isReady'
								) {
									names.push(value.name);

									propertyPath.replace();
								}
							});
					});
			});

		for (const name of names) {
			root.find(j.Identifier, { name }).replaceWith(
				j.booleanLiteral(true),
			);
		}
	});
};

const addUsePathnameImport: IntuitaTransform = (j, root): void => {
	const importDeclarations = root.find(j.ImportDeclaration, {
		type: 'ImportDeclaration',
		specifiers: [
			{
				type: 'ImportSpecifier',
				imported: {
					type: 'Identifier',
					name: 'usePathname',
				},
			},
		],
	});

	if (importDeclarations.size()) {
		return;
	}

	const size = root
		.find(j.CallExpression, {
			callee: {
				name: 'usePathname',
			},
		})
		.size();

	if (!size) {
		return;
	}

	const importDeclaration = j.importDeclaration(
		[
			j.importSpecifier(
				j.identifier('usePathname'),
				j.identifier('usePathname'),
			),
		],
		j.stringLiteral('next/navigation'),
	);

	root.find(j.Program).forEach((program) => {
		program.value.body.unshift(importDeclaration);
	});
};

export default function transform(file: FileInfo, api: API, options: Options) {
	const transforms: IntuitaTransform[] = [
		addUseSearchParamsImport,
		addSearchParamsVariableDeclarator,
		replaceTripleDotRouterQueryWithSearchParams,
		replaceUseRouterPathnameWithUsePathname,
		replaceRouterQueryWithSearchParams,
		replaceUseRouterQueryWithUseSearchParams,
		removeQueryFromDestructuredUseRouterCall,
		replaceQueryWithSearchParams,
		replaceSearchParamsXWithSearchParamsGetX,
		replaceUseMemoSecondArgumentWithSearchParams,
		removeEmptyDestructuring,
		replaceObjectPatternFromSearchParamsWithGetters,
		replaceDestructedPathnameWithUsePathname,
		replaceRouterIsReadyWithTrue,
		removeEmptyDestructuring,
		removeUnusedImportSpecifier,
		removeUnusedImportDeclaration,
		addUsePathnameImport,
	];

	const j = api.jscodeshift;
	const root = j(file.source);

	let dirtyFlag = false;

	for (const intuitaTransform of transforms) {
		dirtyFlag &&= intuitaTransform(j, root);
	}

	return dirtyFlag ? root.toSource() : undefined;
}

transform satisfies Transform;
