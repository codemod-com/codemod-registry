import { API, FileInfo, Options, Transform } from 'jscodeshift';

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	const j = api.jscodeshift;
	const root = j(file.source);

	const hasImportDeclarations = root
		.find(j.ImportDeclaration, {
			specifiers: [
				{
					imported: {
						type: 'Identifier',
						name: 'useRouter',
					},
				},
			],
			source: {
				value: 'next/router',
			},
		})
		.size();

	if (!hasImportDeclarations) {
		return undefined;
	}

	root.find(j.BlockStatement).forEach((blockStatementPath) => {
		const routerNames: string[] = [];

		j(blockStatementPath)
			.find(j.VariableDeclarator, {
				init: {
					type: 'CallExpression',
					callee: {
						type: 'Identifier',
						name: 'useRouter',
					},
				},
				id: {
					type: 'Identifier',
				},
			})
			.forEach((variableDeclarationPath) => {
				if (variableDeclarationPath.node.id.type !== 'Identifier') {
					return null;
				}

				routerNames.push(variableDeclarationPath.node.id.name);
			});

		if (routerNames.length === 0) {
			return;
		}

		// TODO add useSearchParams!

		for (const routerName of routerNames) {
			j(blockStatementPath)
				.find(j.MemberExpression, {
					object: {
						object: {
							name: routerName,
						},

						property: {
							name: 'query',
						},
					},
					property: {
						type: 'Identifier',
					},
				})
				.replaceWith((memberExpressionPath) => {
					if (
						memberExpressionPath.node.property.type !== 'Identifier'
					) {
						return memberExpressionPath;
					}

					return j.callExpression(
						j.memberExpression(
							j.identifier('query'),
							j.identifier('get'),
							false,
						),
						[j.literal('a')],
						// [memberExpressionPath.node.property.name],
					);
				});
		}
	});

	return root.toSource();
}

transformer satisfies Transform;