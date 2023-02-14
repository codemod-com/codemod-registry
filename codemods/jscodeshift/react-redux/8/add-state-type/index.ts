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

const addImportStatement = (j: JSCodeshift, root: Collection<any>) => {
	const importDeclaration = j.importDeclaration(
		[j.importSpecifier(j.identifier('State'), j.identifier('State'))],
		j.stringLiteral('state'),
	);

	root.find(j.Program).forEach((program) => {
		program.value.body.unshift(importDeclaration);
	});

	return [];
};

export default function transform(file: FileInfo, api: API, _: Options) {
	const j = api.jscodeshift;

	const root = j(file.source);

	const options = {
		stateTypeIdentifierName: 'State',
	};

	const modOutputs = upsertTypeAnnotationOnStateParameterOfMapStateToProps(
		j,
		root,
		options,
	);

	for (const modOutput of modOutputs) {
		addImportStatement(j, modOutput.root);
	}

	return root.toSource();
}

transform satisfies Transform;
