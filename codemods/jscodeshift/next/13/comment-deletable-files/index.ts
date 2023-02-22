import type { API, FileInfo, Options, Transform } from 'jscodeshift';
import { basename } from 'node:path';

export default function transform(file: FileInfo, api: API, _: Options) {
	const baseName = basename(file.path);

	if (
		!baseName.startsWith('_document') &&
		!baseName.startsWith('_app') &&
		!baseName.startsWith('_error')
	) {
		return undefined;
	}

	const { j } = api;

	const root = j(file.source);

	root.find(j.Program).forEach((programPath) => {
		const program = programPath.value;

		const comments = program.comments ?? [];

		comments.push(
			j.commentBlock(
				'This file should be deleted. Please migrate its contents to appropriate files',
			),
		);

		program.comments = comments;
	});

	return root.toSource();
}

transform satisfies Transform;
