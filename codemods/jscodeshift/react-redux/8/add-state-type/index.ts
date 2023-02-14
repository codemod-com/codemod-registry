import { API, FileInfo, Options, Transform } from 'jscodeshift';

export default function transform(file: FileInfo, api: API, options: Options) {
	const j = api.jscodeshift;

	const root = j(file.source);

	root.find(j.VariableDeclarator, {
		id: {
			type: 'Identifier',
			name: 'mapStateToProps',
		},
		init: {
			type: 'ArrowFunctionExpression',
		},
	}).forEach((variableDeclaratorPath) => {
		j(variableDeclaratorPath)
			.find(j.ArrowFunctionExpression)
			.replaceWith((arrowFunctionExpressionPath) => {
				const params = arrowFunctionExpressionPath.value.params.map(
					(patternKind, i) => {
						if (i !== 0) {
							return patternKind;
						}

						if (patternKind.type === 'Identifier') {
							const typeAnnotation = j.typeAnnotation(
								j.genericTypeAnnotation(
									j.identifier('State'),
									null,
								),
							);

							return {
								...patternKind,
								typeAnnotation,
							};
						}

						return patternKind;
					},
				);

				return j.arrowFunctionExpression(
					params,
					arrowFunctionExpressionPath.value.body,
					arrowFunctionExpressionPath.value.expression,
				);
			});
	});

	return root.toSource();
}

transform satisfies Transform;
