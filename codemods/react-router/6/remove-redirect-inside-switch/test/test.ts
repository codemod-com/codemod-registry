import type { FileInfo } from 'jscodeshift';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import transform from '../src/index.js';
import assert from 'node:assert/strict';
import { Context } from 'mocha';
import { buildApi } from '@codemod-registry/utilities';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

describe('react-router v6 remove-redirect-inside-switch', function () {
	it('should remove Redirect inside Switch', async function (this: Context) {
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

		const actualOutput = transform(fileInfo, buildApi('js'), {
			quote: 'single',
		});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			output.replace(/\W/gm, ''),
		);
	});
});
