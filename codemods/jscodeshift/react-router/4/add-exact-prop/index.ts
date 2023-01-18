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
		openingElement: { name: { name: 'Route' } },
	}).forEach((path) => {
		const attrs = path.value.openingElement.attributes;

		if (!attrs) {
			return;
		}

		const hasExactAttr =
			attrs.filter((a) => ('name' in a ? a.name.name === 'exact' : false))
				.length > 0;

		if (hasExactAttr) {
			return;
		}

		attrs.unshift(j.jsxAttribute(j.jsxIdentifier('exact'), null));

		dirtyFlag = true;
	});

	if (!dirtyFlag) {
		return undefined;
	}

	return root.toSource(options);
}

transform satisfies Transform;

export default transform;
