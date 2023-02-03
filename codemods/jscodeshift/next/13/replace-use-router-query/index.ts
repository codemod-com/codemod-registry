import {
	API,
	Collection,
	FileInfo,
	Options,
	JSCodeshift,
	ImportDeclaration,
	VariableDeclarator,
	MemberExpression,
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

const findMemberExpressionWithCallExpression =
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
		const routerNames: string[] = [];

		const blockStatement = j(blockStatementPath);

		// 1

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
			const memberExpressionSize = findMemberExpressions(
				routerName,
				'query',
			)(j, blockStatement).size();

			if (memberExpressionSize > 0) {
				hasQueries = true;
				return;
			}
		}

		// 2

		const memberExpressionWithCallExpressionSize =
			findMemberExpressionWithCallExpression('useRouter', 'query')(
				j,
				blockStatement,
			).size();

		if (memberExpressionWithCallExpressionSize > 0) {
			hasQueries = true;
			return;
		}

		// 3

		const vdSize = findVariableDeclaratorWithObjectPatternAndCallExpression(
			'query',
			'useRouter',
		)(j, root).size();

		if (vdSize > 0) {
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

export const transform2: IntuitaTransform = (j, root): Collection<any> => {
	return root;
};

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	const transforms: IntuitaTransform[] = [
		transformAddUseSearchParamsImport,
		transform2,
	];

	const j = api.jscodeshift;
	const root = j(file.source);

	for (const intuitaTransform of transforms) {
		intuitaTransform(j, root);
	}

	return root.toSource();
}
