import {
	API,
	Collection,
	FileInfo,
	JSCodeshift,
	Options,
	Transform,
} from 'jscodeshift';

type ModOutput = Readonly<{
	root: Collection<any>;
	options: { stateTypeIdentifierName: string };
	dirtyFlag: boolean;
	mod: string;
}>;

const upsertTypeAnnotationOnStateParameterOfMapStateToProps = (
	j: JSCodeshift,
	root: Collection<any>,
	options: { stateTypeIdentifierName: string },
): ModOutput[] => {
	let dirtyFlag = false;

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
			.filter((arrowFunctionExpressionPath) => {
				return arrowFunctionExpressionPath.value.params.length !== 0;
			})
			.replaceWith((arrowFunctionExpressionPath) => {
				dirtyFlag = true;

				const params = arrowFunctionExpressionPath.value.params.map(
					(patternKind, i) => {
						if (i !== 0) {
							return patternKind;
						}

						if (patternKind.type === 'Identifier') {
							const typeAnnotation = j.typeAnnotation(
								j.genericTypeAnnotation(
									j.identifier(
										options.stateTypeIdentifierName,
									),
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

	if (!dirtyFlag) {
		return [];
	}

	return [
		{
			root,
			options,
			dirtyFlag,
			mod: 'x',
		},
	];
};

export default function transform(file: FileInfo, api: API, _: Options) {
	const j = api.jscodeshift;

	const root = j(file.source);

	const options = {
		stateTypeIdentifierName: 'State',
	};

	const x = upsertTypeAnnotationOnStateParameterOfMapStateToProps(
		j,
		root,
		options,
	);

	return root.toSource();
}

transform satisfies Transform;
