import { API, FileInfo, ObjectPattern, Options, Position } from 'jscodeshift';

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	const j = api.jscodeshift;
	const root = j(file.source);

	let keyName: string | null = null;

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
			objectPattern.replace(j.objectPattern(properties));

			objectPattern.parent?.parent?.insertAfter(
				j.variableDeclaration('const', [
					j.variableDeclarator(
						j.identifier('pathname'),
						j.callExpression(j.identifier('usePathname'), []),
					),
				]),
			);
		}
	});

	if (!keyName) {
		return undefined;
	}

	return root.toSource();
}
