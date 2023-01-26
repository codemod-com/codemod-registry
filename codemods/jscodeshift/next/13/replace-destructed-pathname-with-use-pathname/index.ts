import { API, FileInfo, ObjectPattern, Options, Transform } from 'jscodeshift';

const buildProxy = <T extends object>(obj: T) => {
	let dirtyFlag = false;

	const proxy = new Proxy(obj, {
		get(target, prop, receiver) {
			if (prop === 'replace' || prop === 'insertAfter') {
				dirtyFlag = true;
			}
			return Reflect.get(target, prop, receiver);
		},
	});

	return [proxy, () => dirtyFlag] as const;
};

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	const j = api.jscodeshift;
	const root = j(file.source);

	let variableDeclarationDirtyFlag = false;

	root.find(j.VariableDeclaration).forEach((variableDeclaration) => {
		let dirtyFlag = false;

		j(variableDeclaration)
			.find(j.ObjectPattern)
			.forEach((objectPatternPath) => {
				const [objectPattern, getDirtyFlag] =
					buildProxy(objectPatternPath);

				let keyName: string | null = null;
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

					dirtyFlag = true;
				}
			});

		if (dirtyFlag) {
			variableDeclaration.insertAfter(
				j.variableDeclaration('const', [
					j.variableDeclarator(
						j.identifier('pathname'),
						j.callExpression(j.identifier('usePathname'), []),
					),
				]),
			);

			variableDeclarationDirtyFlag = true;
		}
	});

	if (!variableDeclarationDirtyFlag) {
		return undefined;
	}

	return root.toSource();
}

transformer satisfies Transform;
