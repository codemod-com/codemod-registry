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

	it('should create an additional function if getStaticProps is present', function () {
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
			async function getUsers(params: any) {
			}

			export // TODO: remove this function
			async function getStaticProps() {
				const users = await promise;

				return { props: { users } };
			}

			export default async function Component({}) {
				const users = await getUsers();

				return users.map(user => <b>user</b>)
			}
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should create additional functions if getStaticProps is present', function () {
		const INPUT = `
			export async function getStaticProps() {
				const users = await promise;
				const groups = await anotherPromise;

				return { props: { users, groups }, revalidate: 1 };
			}

			export default function Component({ users, groups }) {
				return [...users, ...groups].map(obj => <b>{obj}</b>)
	          }
	      `;

		const OUTPUT = `
			// TODO: implement this function
			async function getGroups(params: any) {
			}

			// TODO: implement this function
			async function getUsers(params: any) {
			}

			export // TODO: remove this function
			async function getStaticProps() {
				const users = await promise;
				const groups = await anotherPromise;

				return { props: { users, groups }, revalidate: 1 };
			}

			export default async function Component({}) {
				const groups = await getGroups();
	              const users = await getUsers();

				return [...users, ...groups].map(obj => <b>{obj}</b>)
			}

			export const revalidate = 1;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});
		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should add data hooks on the top level of the component ', function () {
		const INPUT = `
			export async function getStaticProps() {
				const users = await promise;
				const groups = await anotherPromise;

				return { props: { users, groups }, revalidate: 1 };
			}

			export default async function Component({ users, groups }) {
				return <C prop={(a) => {
					return a;
				}}
	      />
			}
	      `;

		const OUTPUT = `
			// TODO: implement this function
			async function getGroups(params: any) {
			}

			// TODO: implement this function
			async function getUsers(params: any) {
			}

			export // TODO: remove this function
			async function getStaticProps() {
				const users = await promise;
				const groups = await anotherPromise;

				return { props: { users, groups }, revalidate: 1 };
			}

			export default async function Component({}) {
				const groups = await getGroups();
	      const users = await getUsers();

				return <C prop={(a) => {
					return a;
				}} />
			}

			export const revalidate = 1;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT?.replace(/\W/gm, ''),
		);
	});

	it('should add generated code after import statements', function () {
		const INPUT = `
			import x from "y";
			export async function getStaticProps() {
				const users = await promise;
				const groups = await anotherPromise;

				return { props: { users, groups }, revalidate: 1 };
			}

			export default function Component({ users, groups }) {
				return <C prop={(a) => {
					return a;
				}}
	      />
			}
	      `;

		const OUTPUT = `
			import x from "y";
			// TODO: implement this function
			async function getGroups(params: any) {
			}

			// TODO: implement this function
			async function getUsers(params: any) {
			}

			export // TODO: remove this function
			async function getStaticProps() {
				const users = await promise;
				const groups = await anotherPromise;

				return { props: { users, groups }, revalidate: 1 };
			}

			export default async function Component({}) {
				const groups = await getGroups();
	      const users = await getUsers();

				return <C prop={(a) => {
					return a;
				}} />
			}

			export const revalidate = 1;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT?.replace(/\W/gm, ''),
		);
	});
	it('should work with arrow functions', function () {
		const INPUT = `
			import x from "y";
			export const getStaticProps = async () => {
				const users = await promise;
				const groups = await anotherPromise;

				return { props: { users, groups }, revalidate: 1 };
			}

			export default function Component({ users, groups }) {
				return <C prop={(a) => {
					return a;
				}}
	      />
			}
	      `;

		const OUTPUT = `
			import x from "y";
			// TODO: implement this function
			async function getGroups(params: any) {
			}

			// TODO: implement this function
			async function getUsers(params: any) {
			}

			export const getStaticProps = // TODO: remove this function
			 async () => {
				const users = await promise;
				const groups = await anotherPromise;

				return { props: { users, groups }, revalidate: 1 };
			}

			export default async function Component({}) {
				const groups = await getGroups();
	      const users = await getUsers();

				return <C prop={(a) => {
					return a;
				}} />
			}

			export const revalidate = 1;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});
		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT?.replace(/\W/gm, ''),
		);
	});

	it('should work with hooks that have multiple return statements', function () {
		const INPUT = `
			import x from "y";
			export const getStaticProps = async () => {
				const users = await promise;
				const groups = await anotherPromise;

				if(false) {
					return { props: { users, groups }}
				}

				return { props: { users, groups }, revalidate: 1 };
			}

			export default function Component({ users, groups }) {
				return <C prop={(a) => {
					return a;
				}}
	      />
			}
	      `;

		const OUTPUT = `
			import x from "y";
			// TODO: implement this function
			async function getGroups(params: any) {
			}

			// TODO: implement this function
			async function getUsers(params: any) {
			}

			export const getStaticProps = // TODO: remove this function
			 async () => {
				const users = await promise;
				const groups = await anotherPromise;

				if(false) {
					return { props: { users, groups }}
				}

				return { props: { users, groups }, revalidate: 1 };
			}

			export default async function Component({}) {
				const groups = await getGroups();
	      const users = await getUsers();

				return <C prop={(a) => {
					return a;
				}} />
			}

			export const revalidate = 1;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});
		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT?.replace(/\W/gm, ''),
		);
	});

	it('should not duplicate revalidate prop', function () {
		const INPUT = `
			import x from "y";
			export const getStaticProps = async () => {
				const users = await promise;
				const groups = await anotherPromise;

				if(false) {
					return { props: { users, groups }, revalidate: 1 }
				}

				return { props: { users, groups }, revalidate: 1 };
			}

			export default async function Component({ users, groups }) {
				return <C prop={(a) => {
					return a;
				}}
	      />
			}
	      `;

		const OUTPUT = `
			import x from "y";
			// TODO: implement this function
			async function getGroups(params: any) {
			}

			// TODO: implement this function
			async function getUsers(params: any) {
			}

			export const getStaticProps = // TODO: remove this function
			 async () => {
				const users = await promise;
				const groups = await anotherPromise;

				if(false) {
					return { props: { users, groups }, revalidate: 1}
				}

				return { props: { users, groups }, revalidate: 1 };
			}

			export default async function Component({}) {
				const groups = await getGroups();
	      const users = await getUsers();

				return <C prop={(a) => {
					return a;
				}} />
			}

			export const revalidate = 1;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT?.replace(/\W/gm, ''),
		);
	});

	it('should replace getServerSideProps', function () {
		const INPUT = `
		export async function getServerSideProps() {
			const res = await fetch(\`https://...\`);
			const projects = await res.json();

			return { props: { projects } };
		}

		export default function Dashboard({ projects }) {
			return (
				<ul>
					{projects.map((project) => (
						<li key={project.id}>{project.name}</li>
					))}
				</ul>
			);
		} `;

		const OUTPUT = `
			// TODO: implement this function
			async function getProjects(params: any) {}

			export // TODO: remove this function
			async function getServerSideProps {
				const res = await fetch(\`https://...\`);
				const projects = await res.json();

				return { props: { projects } };
			}

			export default async function Dashboard({}) {
				const projects = await getProjects();
				return (
					<ul>
						{projects.map((project) => (
							<li key={project.id}>{project.name}</li>
						))}
					</ul>
				);
			}
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should handle getStaticPaths', function () {
		const INPUT = `
		import PostLayout from '@/components/post-layout';
 
		export async function getStaticPaths() {
			return {
				paths: [{ params: { id: '1' } }, { params: { id: '2' } }],
				fallback: true, 
			};
		}
		 
		export async function getStaticProps({ params }) {
			const res = await fetch(\`https://.../posts/\${params.id}\`);
			const post = await res.json();
		 
			return { props: { post } };
		}
		 
		export default function Post({ post }) {
			return <PostLayout post={post} />;
		}
	`;

		const OUTPUT = `
		import PostLayout from '@/components/post-layout';
 
		// TODO: implement this function
		async function getPost(params: any) {}
		
	
		export 	// TODO: implement this function
		async function generateStaticParams() {
			return [];
		}
		
		export // TODO: remove this function
    async function getStaticPaths() {
      return {
              paths: [{ params: { id: '1' } }, { params: { id: '2' } }],
							fallback: true,
      };
    }
		
		export // TODO: remove this function
		async function getStaticProps({ params }) {
			const res = await fetch(\`https://.../posts/\${params.id}\`);
			const post = await res.json();
		 
			return { props: { post } };
		}
		 
		export default async function Post({ params }) {
			const post = await getPost(params);
		 
			return <PostLayout post={post} />;
		}
		
		export const dynamicParams = true; 
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
