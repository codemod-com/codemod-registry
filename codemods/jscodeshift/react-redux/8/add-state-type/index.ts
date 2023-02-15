import {
	API,
	Collection,
	FileInfo,
	JSCodeshift,
	Options,
	Transform,
} from 'jscodeshift';

const upsertTypeAnnotationOnStateParameterOfMapStateToProps = (
	j: JSCodeshift,
	root: Collection<any>,
	options: {
		stateTypeIdentifierName: string;
		stateSourceLiteralValue: string;
	},
) => {
	let dirtyFlag: boolean = false;

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
			.forEach((arrowFunctionExpressionPath) => {
				const patternKind = arrowFunctionExpressionPath.value.params[0];

				if (patternKind?.type !== 'Identifier') {
					return;
				}

				const identifierCollection = j(
					arrowFunctionExpressionPath,
				).find(j.Identifier, {
					name: patternKind.name,
				});

				const typeAnnotation = j.typeAnnotation(
					j.genericTypeAnnotation(
						j.identifier(options.stateTypeIdentifierName),
						null,
					),
				);

				dirtyFlag = true;

				// this uses the fact that the state parameter must be the first
				// found indentifier under the arrow-function-expression
				identifierCollection.paths()[0]?.replace(
					j.identifier.from({
						name: patternKind.name,
						typeAnnotation,
					}),
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
			dirtyFlag: true,
			mod: 'addImportStatement',
		},
	];
};

const addImportStatement = (
	j: JSCodeshift,
	root: Collection<any>,
	{
		stateTypeIdentifierName,
		stateSourceLiteralValue,
	}: { stateTypeIdentifierName: string; stateSourceLiteralValue: string },
) => {
	const importDeclaration = j.importDeclaration(
		[
			j.importSpecifier(
				j.identifier(stateTypeIdentifierName),
				j.identifier(stateTypeIdentifierName),
			),
		],
		j.stringLiteral(stateSourceLiteralValue),
	);

	root.find(j.Program).forEach((programPath) => {
		programPath.value.body.unshift(importDeclaration);
	});

	return [];
};

export default function transform(file: FileInfo, api: API, jOptions: Options) {
	const j = api.jscodeshift;

	let dirtyFlag = false;

	const root = j(file.source);

	const options = {
		stateTypeIdentifierName:
			'stateTypeIdentifierName' in jOptions
				? String(jOptions.stateTypeIdentifierName)
				: 'State',
		stateSourceLiteralValue:
			'stateSourceLiteralValue' in jOptions
				? String(jOptions.stateSourceLiteralValue)
				: 'state',
	};

	const modOutputs = upsertTypeAnnotationOnStateParameterOfMapStateToProps(
		j,
		root,
		options,
	);

	for (const modOutput of modOutputs) {
		if (modOutput.mod === 'addImportStatement') {
			addImportStatement(j, modOutput.root, modOutput.options);
		}
	}

	return root.toSource();
}

transform satisfies Transform;
