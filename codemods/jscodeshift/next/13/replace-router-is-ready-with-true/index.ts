import { API, FileInfo, Options, Transform } from 'jscodeshift';

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	const j = api.jscodeshift;
	const root = j(file.source);

	let dirtyFlag = false;

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
		dirtyFlag = true;

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
		dirtyFlag = true;

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
							.find(j.Property)
							.forEach((propertyPath) => {
								const { key, value } = propertyPath.node;

								if (
									key.type === 'Identifier' &&
									value.type === 'Identifier' &&
									key.name === 'isReady'
								) {
									names.push(value.name);

									propertyPath.replace();
									dirtyFlag = true;
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

	if (!dirtyFlag) {
		return undefined;
	}

	return root.toSource();
}

transformer satisfies Transform;
