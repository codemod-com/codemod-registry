import { FileInfo } from 'jscodeshift';
import { Context } from 'mocha';
import assert from 'node:assert';
import transform from '.';

describe.only('next 13 comment-deletable-files', function () {
	it('should add a comment', async function (this: Context) {
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

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
