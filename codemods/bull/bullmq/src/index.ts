import type { API, FileInfo } from 'jscodeshift';
import { replaceOldQueueImport } from './imports.js';
import { replaceQueueOpts } from './queue.js';
import { replaceListeners } from './listeners.js';
import { replaceProcessWithWorkers } from './worker.js';
import { replaceTypeReferences } from './correct-types.js';

export default function transform(
	file: FileInfo,
	api: API,
): string | undefined {
	const j = api.jscodeshift;
	const root = j(file.source);

	replaceOldQueueImport(root, j);
	replaceQueueOpts(root, j);
	replaceTypeReferences(root, j);

	replaceListeners(root, j);
	replaceProcessWithWorkers(root, j);

	return root.toSource();
}
