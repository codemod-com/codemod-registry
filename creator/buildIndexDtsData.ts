import type { ArgvSchema } from './schema.js';

export const buildIndexDtsData = (argv: ArgvSchema): string | null => {
	if (argv.engine === 'jscodeshift') {
		return [
			"import type { API, FileInfo } from 'jscodeshift';",
			'export default function transform(file: FileInfo, api: API): string;',
		].join('\n');
	}

	if (argv.engine === 'ts-morph') {
		return [
			"import type { SourceFile } from 'ts-morph';",
			'export function handleSourceFile(sourceFile: SourceFile): string | undefined;',
		].join('\n');
	}

	if (argv.engine === 'repomod-engine') {
		return [
			"import type { Filemod } from '@intuita-inc/filemod';",
			'export const repomod: Filemod<{}, {}>;',
		].join('\n');
	}

	return null;
};
