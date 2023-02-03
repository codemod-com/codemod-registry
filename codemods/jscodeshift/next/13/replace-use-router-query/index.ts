import { API, Collection, FileInfo, Options, Transform } from 'jscodeshift';

type IntuitaTransform = (root: Collection<any>) => Collection<any>;

export const transform1: IntuitaTransform = (
	root: Collection<any>,
): Collection<any> => {
	return root;
};

export const transform2: IntuitaTransform = (
	root: Collection<any>,
): Collection<any> => {
	return root;
};

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	const transforms: IntuitaTransform[] = [transform1, transform2];

	const j = api.jscodeshift;
	let root = j(file.source);

	for (const intuitaTransform of transforms) {
		root = intuitaTransform(root);
	}

	return root.toSource();
}
