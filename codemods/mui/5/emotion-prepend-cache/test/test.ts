import type { API, FileInfo } from 'jscodeshift';
import jscodeshift from 'jscodeshift';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import transform from '..';
import assert from 'node:assert/strict';

describe('@mui v5 emotion-prepend-cache', function () {
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

	it('test migration', async function () {
		const input = await readFile(
			join(__dirname, 'input-custom-naming.js'),
			{
				encoding: 'utf8',
			},
		);

		const output = await readFile(
			join(__dirname, 'output-custom-naming.js'),
			{
				encoding: 'utf8',
			},
		);

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

	it('test migration 2', async function () {
		const input = await readFile(
			join(__dirname, 'input-default-naming.js'),
			{
				encoding: 'utf8',
			},
		);

		const output = await readFile(
			join(__dirname, 'output-default-naming.js'),
			{
				encoding: 'utf8',
			},
		);

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

	it('test migration 3', async function () {
		const input = await readFile(
			join(__dirname, 'input-replace-existing-prepend.js'),
			{
				encoding: 'utf8',
			},
		);

		const output = await readFile(
			join(__dirname, 'output-replace-existing-prepend.js'),
			{
				encoding: 'utf8',
			},
		);

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
