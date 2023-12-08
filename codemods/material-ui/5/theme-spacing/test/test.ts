import type { FileInfo } from 'jscodeshift';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import transform from '..';
import assert from 'node:assert/strict';

describe('@material-ui/core v5 theme-spacing', function () {
	it('test migration', async function () {
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

		const actualOutput = transform(fileInfo);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			output.replace(/\W/gm, ''),
		);
	});
});
