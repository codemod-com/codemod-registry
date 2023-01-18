import type { FileInfo, API, Options, Transform } from 'jscodeshift';

function transform(
	file: FileInfo,
	api: API,
	options: Options,
): string | undefined {
	const j = api.jscodeshift;
	const root = j(file.source);

	let dirtyFlag = false;

	root.find(j.JSXElement, {
		openingElement: { name: { name: 'Router' } },
	}).forEach((path) => {
		const attrs = path.value.openingElement.attributes;

		if (!attrs) {
			return;
		}

		const hasHistoryAttr =
			attrs.filter((a) =>
				'name' in a ? a.name.name === 'history' : false,
			).length > 0;

		if (hasHistoryAttr) {
			const [historyAttr] = attrs.filter((a) =>
				'name' in a ? a.name.name === 'history' : false,
			);

			if (historyAttr && 'value' in historyAttr) {
				historyAttr.value = j.jsxExpressionContainer(
					j.identifier('history'),
				);

				dirtyFlag = true;
			}
		}

		const hasCreateHashHistoryImport =
			root.find(j.ImportDeclaration, {
				source: { value: 'history/createHashHistory' },
			}).length > 0;

		if (hasCreateHashHistoryImport) {
			return;
		}

		let computedImport = j.importDeclaration(
			[j.importDefaultSpecifier(j.identifier('createHashHistory'))],
			j.literal('history/createHashHistory'),
		);

		let body = root.get().value.program.body;
		body.unshift(computedImport);

		const vardecl = j.variableDeclaration('const', [
			j.variableDeclarator(
				j.identifier('history'),
				j.callExpression(j.identifier('createHashHistory'), []),
			),
		]);

		body.unshift(vardecl);

		dirtyFlag = true;
	});

	if (!dirtyFlag) {
		return undefined;
	}

	return root.toSource(options);
}

transform satisfies Transform;

export default transform;
