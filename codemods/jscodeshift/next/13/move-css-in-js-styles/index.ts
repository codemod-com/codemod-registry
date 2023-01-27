import { API, ASTPath, FileInfo, Options, Transform } from 'jscodeshift';

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	const j = api.jscodeshift;
	const root = j(file.source);

	let dirtyFlag = false;

	root.find(j.JSXElement, {
		type: 'JSXElement',
		openingElement: {
			type: 'JSXOpeningElement',
			name: { type: 'JSXIdentifier', name: 'style' },
		},
	}).forEach((jsxElementPath) => {
		const x: typeof jsxElementPath = jsxElementPath.parentPath; // todo how to ensure the correct types?

		if (x?.node?.type !== 'JSXElement') {
			return;
		}

		x.node.openingElement.attributes =
			x.node.openingElement.attributes ?? [];

		x.node.openingElement.attributes.push(
			j.jsxAttribute(
				j.jsxIdentifier('className'),
				j.jsxExpressionContainer(
					j.memberExpression(
						j.literal('styles'),
						j.literal('wrapper'),
					),
				),
			),
		);

		jsxElementPath.replace();

		dirtyFlag = true;
	});

	if (!dirtyFlag) {
		return undefined;
	}

	const importDeclaration = j.importDeclaration(
		[j.importSpecifier(j.identifier('styles'), j.identifier('styles'))],
		j.stringLiteral('index.module.css'),
	);

	root.find(j.Program).forEach((program) => {
		program.value.body.unshift(importDeclaration);
	});

	return root.toSource();
}

transformer satisfies Transform;
