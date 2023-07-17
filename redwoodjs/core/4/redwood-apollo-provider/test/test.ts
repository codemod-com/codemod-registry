import type { API, FileInfo } from 'jscodeshift';
import jscodeshift from 'jscodeshift';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import transform from '../index.js';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

describe('@redwoodjs/core v4 redwood-apollo-provider', function () {
	it('should add AuthProvider and useAuth', async function () {
		const input = await readFile(join(__dirname, 'input.js'), {
			encoding: 'utf8',
		});

		const output = await readFile(join(__dirname, 'output.js'), {
			encoding: 'utf8',
		});

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: input,
		};

		const buildApi = (parser: string): API => ({
			j: jscodeshift.withParser(parser),
			jscodeshift: jscodeshift.withParser(parser),
			stats: () => {
				console.error(
					'The stats function was called, which is not supported on purpose',
				);
			},
			report: () => {
				console.error(
					'The report function was called, which is not supported on purpose',
				);
			},
		});

		const actualOutput = transform(fileInfo, buildApi('js'), {
			quote: 'single',
		});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			output.replace(/\W/gm, ''),
		);
	});
});
