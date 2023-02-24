import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from '.';

describe('next 13 remove-get-static-props', function () {
	it('should not remove anything if getStaticProps', function () {
		const INPUT = `
			export default function Component() {
            }
        `;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

		assert.deepEqual(actualOutput, undefined);
	});

	it('should not remove anything if getStaticProps', function () {
		const INPUT = `
			export async function getStaticProps() {
				const users = await promise;
			  
				return { props: { users } };
			}
			  
			export default function Component({ users }) {
				return users.map(user => <b>user</b>)
            }
        `;

		const OUTPUT = `
			// TODO: implement this function
			async function getUsers() {
			}

			export // TODO: remove this function
			async function getStaticProps() {
				const users = await promise;
			
				return { props: { users } };
			}

			export default function Component() {
				const users = await getUsers();

				return users.map(user => <b>user</b>)
			}
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

		console.log(actualOutput);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
