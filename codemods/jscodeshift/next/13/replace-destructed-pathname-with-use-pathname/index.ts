import { API, FileInfo, ObjectPattern, Options, Position } from 'jscodeshift';

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	const j = api.jscodeshift;
	const root = j(file.source);

	let keyName: string | null = null;
	let objectPatternStart: Position | null = null;

	root.find(j.ObjectPattern).forEach((objectPattern) => {
		const properties: ObjectPattern['properties'] = [];

		objectPattern.value.properties.forEach((property) => {
			if (property.type === 'Property') {
				const { key, value } = property;

				if (
					key.type === 'Identifier' &&
					value.type === 'Identifier' &&
					value.name === 'pathname'
				) {
					keyName = key.name;

					return;
				}
			}

			properties.push(property);
		});

		if (keyName) {
			objectPatternStart = objectPattern.value.loc?.start ?? null;

			objectPattern.replace(j.objectPattern(properties));
		}
	});

	if (!keyName) {
		return undefined;
	}

	root.find(j.VariableDeclaration).forEach((variableDeclaration) => {
		const start = variableDeclaration.value.loc?.start;

		if (objectPatternStart && start && objectPatternStart)
			variableDeclaration.insertAfter(
				j.variableDeclaration('const', [
					j.variableDeclarator(
						j.identifier('pathname'),
						j.callExpression(j.identifier('usePathname'), []),
					),
				]),
			);
	});

	return root.toSource();
}
