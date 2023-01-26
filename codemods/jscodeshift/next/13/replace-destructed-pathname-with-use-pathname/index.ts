import { API, FileInfo, Options, Transform } from 'jscodeshift';

const buildProxy = <T extends object>(obj: T, onDirty: () => void) => {
	let dirtyFlag = false;

	return new Proxy(obj, {
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
};

type DirtyFlag = 'variableDeclaration' | 'propertyPath';

const PATHNAME = 'pathname';
const USE_PATHNAME = 'usePathname';

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

		let valueName: string | null = null;

		j(variableDeclaration)
			.find(j.ObjectPattern)
			.forEach((objectPatternPath) => {
				j(objectPatternPath)
					.find(j.Property)
					.forEach((propertyPath) => {
						const propertyPathProxy = buildProxy(
							propertyPath,
							buildOnDirty('propertyPath'),
						);

						const { key, value } = propertyPathProxy.value;

						if (
							key.type === 'Identifier' &&
							value.type === 'Identifier' &&
							key.name === PATHNAME
						) {
							valueName = value.name;

							propertyPathProxy.replace();
						}
					});
			});

		if (dirtyFlags.has('propertyPath') && valueName) {
			variableDeclaration.insertAfter(
				j.variableDeclaration('const', [
					j.variableDeclarator(
						j.identifier(valueName),
						j.callExpression(j.identifier(USE_PATHNAME), []),
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
