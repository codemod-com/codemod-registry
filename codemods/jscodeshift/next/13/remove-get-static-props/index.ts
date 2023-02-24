import type { API, FileInfo, Options, Transform } from 'jscodeshift';

export default function transform(
	file: FileInfo,
	api: API,
	options: Options,
): string | undefined {
	return undefined;
}

transform satisfies Transform;
