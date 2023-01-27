import { API, FileInfo, Options, Transform } from 'jscodeshift';

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	const j = api.jscodeshift;
	const root = j(file.source);

	let dirtyFlag = false;

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
					.replaceWith((objectPatternPath) => {
						const properties =
							objectPatternPath.node.properties.filter(
								(property) =>
									!(
										property.type === 'Property' &&
										property.key.type === 'Identifier' &&
										property.key.name === 'query'
									),
							);

						return j.objectPattern(properties);
					});
			});
	});

	root.find(j.VariableDeclaration).forEach((variableDeclarationPath) => {
		let hasQuery = false;
		let names: string[] = [];

		variableDeclarationPath.node.declarations =
			variableDeclarationPath.node.declarations.filter((declaration) => {
				if (declaration.type !== 'VariableDeclarator') {
					return true;
				}

				if (declaration.init?.type !== 'Identifier') {
					return true;
				}

				if (declaration.init.name === 'query') {
					hasQuery = true; // not clean fp

					if (declaration.id.type === 'ObjectPattern') {
						declaration.id.properties.forEach((property) => {
							if (
								property.type === 'Property' &&
								property.key.type === 'Identifier'
							) {
								names.push(property.key.name);
							}
						});
					}

					return false;
				}
			});

		if (!hasQuery) {
			return;
		}

		if (variableDeclarationPath.node.declarations.length === 0) {
			variableDeclarationPath.replace();
		}

		for (const name of names.reverse()) {
			variableDeclarationPath.insertAfter(
				j.variableDeclaration('const', [
					j.variableDeclarator(
						j.identifier(name),
						j.memberExpression(
							j.identifier('query'),
							j.callExpression(j.identifier('get'), [
								j.identifier(`"${name}"`),
							]),
						),
					),
				]),
			);
		}

		variableDeclarationPath.insertAfter(
			j.variableDeclaration('const', [
				j.variableDeclarator(
					j.identifier('query'),
					j.callExpression(j.identifier('useSearchParams'), []),
				),
			]),
		);
	});

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

	return root.toSource();
}

transformer satisfies Transform;
