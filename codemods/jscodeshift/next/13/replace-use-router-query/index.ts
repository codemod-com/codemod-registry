import { API, Collection, FileInfo, Options } from 'jscodeshift';

type IntuitaTransform = (
	j: API['jscodeshift'],
	root: Collection<any>,
) => Collection<any>;

export const transformAddUseSearchParamsImport: IntuitaTransform = (
	j: API['jscodeshift'],
	root: Collection<any>,
): Collection<any> => {
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
		return root;
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
			})
			.forEach((variableDeclaratorPath) => {
				const { id } = variableDeclaratorPath.node;

				if (id.type !== 'Identifier') {
					return;
				}

				routerNames.push(id.name);
			});

		if (routerNames.length === 0) {
			return;
		}

		for (const routerName of routerNames) {
			const size = j(blockStatementPath)
				.find(j.MemberExpression, {
					object: {
						type: 'Identifier',
						name: routerName,
					},
					property: {
						type: 'Identifier',
						name: 'query',
					},
				})
				.size();
		}

		// check query
	});

	return root;
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
	let root = j(file.source);

	for (const intuitaTransform of transforms) {
		root = intuitaTransform(j, root);
	}

	return root.toSource();
}
