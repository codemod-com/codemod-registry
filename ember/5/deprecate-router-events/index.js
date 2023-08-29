import codemodCLI from 'codemod-cli';

const {
	jscodeshift: { getParser },
} = codemodCLI;

export default function transformer(file, api) {
	const j = getParser(api);

	const root = j(file.source);

	const createInit = (props, exp1, exp2) => {
		// First create the super call for init
		let superCall = j.expressionStatement(
			j.callExpression(
				j.memberExpression(
					j.thisExpression(),
					j.identifier('_super'),
					false,
				),
				[j.identifier('...arguments')],
			),
		);

		let initProp = j.objectMethod(
			'method',
			j.identifier('init'),
			[],
			j.blockStatement([superCall, exp1, exp2]),
		);

		props.push(initProp);
	};

	root.find(j.ExportDefaultDeclaration, {
		declaration: {
			callee: {
				object: {
					name: 'Router',
				},
			},
		},
	}).forEach((path) => {
		let args = path.value.declaration.arguments[0];
		let props = args.properties;

		let idxWillTransition = props.findIndex(
			(p) => p.key.name === 'willTransition',
		);
		let routeWillChange;

		if (idxWillTransition >= 0) {
			let wtBody = props[idxWillTransition].value
				? props[idxWillTransition].value.body.body
				: props[idxWillTransition].body.body;

			wtBody.splice(0, 1); // Remove super call
			routeWillChange = j.expressionStatement(
				j.callExpression(
					j.memberExpression(
						j.thisExpression(),
						j.identifier('on'),
						false,
					),
					[
						j.literal('routeWillChange'),
						j.arrowFunctionExpression(
							[j.identifier('transition')],
							j.blockStatement(wtBody),
							false,
						),
					],
				),
			);

			// Cleanup
			props.splice(
				props.findIndex((p) => p.key.name === 'willTransition'),
				1,
			);
		}

		let idxDidTransition = props.findIndex(
			(p) => p.key.name === 'didTransition',
		);
		let routeDidChange;

		if (idxDidTransition >= 0) {
			let dtBody = props[idxDidTransition].value
				? props[idxDidTransition].value.body.body
				: props[idxDidTransition].body.body;

			dtBody.splice(0, 1); // Remove super call

			routeDidChange = j.expressionStatement(
				j.callExpression(
					j.memberExpression(
						j.thisExpression(),
						j.identifier('on'),
						false,
					),
					[
						j.literal('routeDidChange'),
						j.arrowFunctionExpression(
							[j.identifier('transition')],
							j.blockStatement(dtBody),
							false,
						),
					],
				),
			);

			// Cleanup
			props.splice(
				props.findIndex((p) => p.key.name === 'didTransition'),
				1,
			);
		}

		let initFn = props.filter((p) => {
			return p.key.name === 'init';
		})[0];

		if (initFn) {
			let initFnBody = initFn.body.body;
			initFnBody.push(routeWillChange, routeDidChange);
		} else {
			// We don't have an init() , hence create one

			createInit(props, routeWillChange, routeDidChange);
		}
	});

	return root.toSource({ quote: 'single' });
}
