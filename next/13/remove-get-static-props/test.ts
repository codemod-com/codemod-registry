import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from './index.js';
import { buildApi } from '../../../utilities.js';

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

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});

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
			import { GetStaticPropsContext } from 'next';
			async function getData(ctx: GetStaticPropsContext){
				return (await getStaticProps(ctx)).props;
			}

			export
			async function getStaticProps() {
				const users = await promise;

				return { props: { users } };
			}

			export default async function Component({ params }) {
				const {users} = await getData({
					params, 
				});

				return users.map(user => <b>user</b>)
			}
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});
		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should create an additional function if getStaticProps returns an Identifier', function () {
		const INPUT = `
			export async function getStaticProps(context: GetStaticPropsContext) {
				const users = await promise(context.params);
				const res = { props: { users } };
				return res;
			}

			export default function Component({ users }) {
				return users.map(user => <b>user</b>)
	          }
	      `;

		const OUTPUT = `
			import { GetStaticPropsContext } from 'next';
			async function getData(ctx: GetStaticPropsContext){
				return (await getStaticProps(ctx)).props;
			}

			export async function getStaticProps(context: GetStaticPropsContext) {
				const users = await promise(context.params);
				const res = { props: { users } };
				return res;
			}

			export default async function Component({ params }) {
				const {users} = await getData({
					params, 
				});

				return users.map(user => <b>user</b>)
			}
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});
		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should replace props nested props properly', function () {
		const INPUT = `
			export async function getStaticProps() {
				const allPosts = await promise;
				return { props: { allPosts } };
			}

			export default function Component({ allPosts: { edges }}) {
			return edges.map(edge => <b>edge</b>)
	          }
	      `;

		const OUTPUT = `
			import { GetStaticPropsContext } from 'next';
			async function getData(ctx: GetStaticPropsContext){
				return (await getStaticProps(ctx)).props;
			}

			export 
			async function getStaticProps() {
				const allPosts = await promise;
				return { props: { allPosts } };
			}

			export default async function Component({ params }) {
				const { allPosts: { edges } } = await getData({params});

				return edges.map(edge => <b>edge</b>)
			}
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});

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
		import { GetStaticPropsContext } from 'next';
		async function getData(ctx: GetStaticPropsContext){
			return (await getStaticProps(ctx)).props;
		}

			export 
			async function getStaticProps() {
				const users = await promise;
				const groups = await anotherPromise;

				return { props: { users, groups }, revalidate: 1 };
			}

			export default async function Component({ params }) {
				const {users, groups } = await getData({ params });

				return [...users, ...groups].map(obj => <b>{obj}</b>)
			}

			export const revalidate = 1;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});
		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should inject data fetching function when props are not destructured', function () {
		const INPUT = `
			export async function getStaticProps() {
				const users = await promise;
				return { props: { users } };
			}

			function SingleAppPage(props: inferSSRProps<typeof getStaticProps>) {
					return null;
			}
			
			export default SingleAppPage;
			
	    `;

		const OUTPUT = `
			import { GetStaticPropsContext } from 'next';
			
			async function getData(ctx: GetStaticPropsContext){
				return (await getStaticProps(ctx)).props;
			}

			export async function getStaticProps() {
				const users = await promise;
				return { props: { users } };
			}

			async function SingleAppPage(props: inferSSRProps<typeof getStaticProps>) {
				const props = await getData({ params });
				return null;
		}
		
		export default SingleAppPage;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});
		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should inject data fetching function when Page component has implicit return', function () {
		const INPUT = `
			export async function getStaticProps() {
				const users = await promise;
				return { props: { users } };
			}

			const Home = ({ users }) => (<Component users={users} />);
			
			export default Home;
	    `;

		const OUTPUT = `
			import { GetStaticPropsContext } from 'next';
			
			async function getData(ctx: GetStaticPropsContext){
				return (await getStaticProps(ctx)).props;
			}

			export async function getStaticProps() {
				const users = await promise;
				return { props: { users } };
			}

			const Home = async ({ params }) => {
				const { users } = await getData({ params });
				return (<Component users={users} />)
			};
			
			export default Home;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});
		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should inject data fetching function when Page component has implicit return 2', function () {
		const INPUT = `
			export async function getStaticProps() {
				const users = await promise;
				return { props: { users } };
			}

			const Home = ({ users }) => (<><Component users={users} /></>);
			
			export default Home;
	    `;

		const OUTPUT = `
			import { GetStaticPropsContext } from 'next';
			
			async function getData(ctx: GetStaticPropsContext){
				return (await getStaticProps(ctx)).props;
			}

			export async function getStaticProps() {
				const users = await promise;
				return { props: { users } };
			}

			const Home = async ({ params }) => {
				const { users } = await getData({ params });
				return (<><Component users={users} /></>)
			};
			
			export default Home;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});
		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should inject data fetching function when Page component is functionexpression', function () {
		const INPUT = `
			export async function getStaticProps() {
				const users = await promise;
				return { props: { users } };
			}

			const AppPage: AppPageType['default'] = function AppPage(props) {
				return null;
			};
			
			export default AppPage;
	    `;

		const OUTPUT = `
			import { GetStaticPropsContext } from 'next';
			
			async function getData(ctx: GetStaticPropsContext){
				return (await getStaticProps(ctx)).props;
			}

			export async function getStaticProps() {
				const users = await promise;
				return { props: { users } };
			}

			const AppPage: AppPageType['default'] = async function AppPage({ params }) {
				const props = await getData({ params });
				return null;
			};
			
			export default AppPage;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});
		console.log(actualOutput);
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
		import { GetStaticPropsContext } from 'next';
		async function getData(ctx: GetStaticPropsContext){
			return (await getStaticProps(ctx)).props;
		}

			export
			async function getStaticProps() {
				const users = await promise;
				const groups = await anotherPromise;

				return { props: { users, groups }, revalidate: 1 };
			}

			export default async function Component({params}) {
				const { users, groups } = await getData({ params });

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

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});

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
		import { GetStaticPropsContext } from 'next';
			import x from "y";
			async function getData(ctx: GetStaticPropsContext){
				return (await getStaticProps(ctx)).props;
			}

			export
			async function getStaticProps() {
				const users = await promise;
				const groups = await anotherPromise;

				return { props: { users, groups }, revalidate: 1 };
			}

			export default async function Component({ params }) {
				const { users, groups } = await getData(params);

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

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});

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
			import { GetStaticPropsContext } from 'next';
			import x from "y";

			async function getData(ctx: GetStaticPropsContext){
				return (await getStaticProps(ctx)).props;
			}

			export const getStaticProps = 
			 async () => {
				const users = await promise;
				const groups = await anotherPromise;

				return { props: { users, groups }, revalidate: 1 };
			}

			export default async function Component({ params }) {
				const { users, groups } = await getData({ params });

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

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});
		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT?.replace(/\W/gm, ''),
		);
	});

	it('should work with hooks that have multiple return statements', function () {
		const INPUT = `
			import x from "y";
			export const getStaticProps =  async () => {
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
		import { GetStaticPropsContext } from 'next';
			import x from "y";
			async function getData(ctx: GetStaticPropsContext){
				return (await getStaticProps(ctx)).props;
			}

			export const getStaticProps =  
			 async () => {
				const users = await promise;
				const groups = await anotherPromise;

				if(false) {
					return { props: { users, groups }}
				}

				return { props: { users, groups }, revalidate: 1 };
			}

			export default async function Component({ params }) {
				const { users, groups } = await getData({ params });

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

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});
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
		import { GetStaticPropsContext } from 'next';
			import x from "y";
			
			async function getData(ctx: GetStaticPropsContext){
				return (await getStaticProps(ctx)).props;
			}

			export const getStaticProps = 
			 async () => {
				const users = await promise;
				const groups = await anotherPromise;

				if(false) {
					return { props: { users, groups }, revalidate: 1}
				}

				return { props: { users, groups }, revalidate: 1 };
			}

			export default async function Component({ params }) {
				const { users, groups } = await getData({ params });

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

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});

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
		import { GetServerSidePropsContext } from 'next';
			async function getData(ctx: GetServerSidePropsContext){
				return (await getServerSideProps(ctx)).props;
			}
			export
			async function getServerSideProps() {
				const res = await fetch(\`https://...\`);
				const projects = await res.json();

				return { props: { projects } };
			}

			export default async function Dashboard({ params }) {
				const {projects} = await getData({ params });
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

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});

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
		import { GetStaticPropsContext } from "next";
		import PostLayout from '@/components/post-layout';

		type PageParams = {};

	  type PageProps = {
	  	params: PageParams
	  };

		export async function generateStaticParams() {
			return (await getStaticPaths({})).paths;
		}
		
		async function getData(ctx: GetStaticPropsContext){
			return (await getStaticProps(ctx)).props;
		}

		export 
	  async function getStaticPaths() {
	    return {
	            paths: [{ params: { id: '1' } }, { params: { id: '2' } }],
							fallback: true,
	    };
	  }

		export
		async function getStaticProps({ params }) {
			const res = await fetch(\`https://.../posts/\${params.id}\`);
			const post = await res.json();

			return { props: { post } };
		}

		export default async function Post({ params }) {
			const {post} = await getData({params});

			return <PostLayout post={post} />;
		}

		export const dynamicParams = true;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should transform fallback property correctly 2', function () {
		const INPUT = `
		import PostLayout from '@/components/post-layout';

		export async function getStaticPaths() {
			return {
				paths: [{ params: { id: '1' } }, { params: { id: '2' } }],
				fallback: false,
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
		import { GetStaticPropsContext } from "next";
		import PostLayout from '@/components/post-layout';

		type PageParams = {};

	  type PageProps = {
	  	params: PageParams
	  };

		export async function generateStaticParams() {
			return (await getStaticPaths({})).paths;
		}
		
		async function getData(ctx: GetStaticPropsContext){
			return (await getStaticProps(ctx)).props;
		}

		export 
	  async function getStaticPaths() {
	    return {
	            paths: [{ params: { id: '1' } }, { params: { id: '2' } }],
							fallback: false,
	    };
	  }

		export 
		async function getStaticProps({ params }) {
			const res = await fetch(\`https://.../posts/\${params.id}\`);
			const post = await res.json();

			return { props: { post } };
		}

		export default async function Post({ params }) {
			const {post} = await getData({params});

			return <PostLayout post={post} />;
		}

		export const dynamicParams = false;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});
		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
	it('should transform fallback property correctly', function () {
		const INPUT = `
		import PostLayout from '@/components/post-layout';

		export async function getStaticPaths() {
			return {
				paths: [{ params: { id: '1' } }, { params: { id: '2' } }],
				fallback: 'blocking',
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
		import { GetStaticPropsContext } from "next";
		import PostLayout from '@/components/post-layout';

		type PageParams = {};

	  type PageProps = {
	  	params: PageParams
	  };

		export async function generateStaticParams() {
			return (await getStaticPaths({})).paths;
		}

		async function getData(ctx: GetStaticPropsContext){
			return (await getStaticProps(ctx)).props;
		}

		export
	  async function getStaticPaths() {
	    return {
	            paths: [{ params: { id: '1' } }, { params: { id: '2' } }],
							fallback: 'blocking',
	    };
	  }

		export 
		async function getStaticProps({ params }) {
			const res = await fetch(\`https://.../posts/\${params.id}\`);
			const post = await res.json();

			return { props: { post } };
		}

		export default async function Post({ params }) {
			const {post} = await getData({params});

			return <PostLayout post={post} />;
		}

		export const dynamicParams = true;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});
		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
