import { FileInfo } from 'jscodeshift';
import { Context } from 'mocha';
import assert from 'node:assert';
import transform from '../src/index.js';
import { buildApi } from '@codemod-registry/utilities';

describe('next 13 comment-deletable-files', function () {
	it('should not add a comment if a file basename does not start with _app / _document / _error', async function (this: Context) {
		const INPUT = `
			import { useRouter } from 'next/router';

			export function Component() {
				const { query } = useRouter();

				if (query.a && query.b) {

				}
			}
		`;

		const fileInfo: FileInfo = {
			path: '_other.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));

		assert.deepEqual(actualOutput, undefined);
	});

	it('should add a comment if a file basename starts with _app', async function (this: Context) {
		const INPUT = `
			import { useRouter } from 'next/router';

			export function Component() {
				const { query } = useRouter();

				if (query.a && query.b) {

				}
			}
		`;
		const OUTPUT = `
            /*This file should be deleted. Please migrate its contents to appropriate files*/
			import { useRouter } from 'next/router';

			export function Component() {
				const { query } = useRouter();

				if (query.a && query.b) {

				}
			}
		`;

		const fileInfo: FileInfo = {
			path: '_app.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
