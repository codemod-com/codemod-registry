import { API, FileInfo, ObjectPattern, Options, Transform } from 'jscodeshift';

const buildProxy = <T extends object>(obj: T, onDirty: () => void) => {
	let dirtyFlag = false;

	const proxy = new Proxy(obj, {
		get(target, prop, receiver) {
			if (prop === 'replace' || prop === 'insertAfter') {
				if (!dirtyFlag) {
					dirtyFlag = true;
					onDirty();
				}
			}
			return Reflect.get(target, prop, receiver);
		},
	});

	return proxy;
};

type DirtyFlag = 'objectPattern' | 'variableDeclaration';

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	let dirtyFlags = new Set<DirtyFlag>();

	const buildOnDirty = (value: DirtyFlag) => () => {
		dirtyFlags.add(value);
	};

	const j = api.jscodeshift;
	const root = j(file.source);

	root.find(j.VariableDeclaration).forEach((variableDeclarationPath) => {
		const variableDeclaration = buildProxy(
			variableDeclarationPath,
			buildOnDirty('variableDeclaration'),
		);

		j(variableDeclaration)
			.find(j.ObjectPattern)
			.forEach((objectPatternPath) => {
				const objectPattern = buildProxy(
					objectPatternPath,
					buildOnDirty('objectPattern'),
				);

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
				}
			});

		if (dirtyFlags.has('objectPattern')) {
			variableDeclaration.insertAfter(
				j.variableDeclaration('const', [
					j.variableDeclarator(
						j.identifier('pathname'),
						j.callExpression(j.identifier('usePathname'), []),
					),
				]),
			);
		}
	});

	if (!dirtyFlags.has('variableDeclaration')) {
		return undefined;
	}

	return root.toSource();
}

transformer satisfies Transform;
