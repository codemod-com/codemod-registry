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

		const actualOutput = transform(fileInfo, buildApi('tsx'));

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
		type Params = {
			[key: string]: string | string[] | undefined
		};

		type PageProps = {
				params: Params
		};
		
			export async function getStaticProps() {
				const users = await promise;

				return { props: { users } };
			}

			async function getData(
				{
						params
				}: { params: Params }
		) {
				const users = await promise;

				return { users };
		}

			export default async function Component({ params }: PageProps) {
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

		const actualOutput = transform(fileInfo, buildApi('tsx'));
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
			import { notFound, redirect } from "next/navigation";
			
			type Params = {
				[key: string]: string | string[] | undefined
			};

			type PageProps = {
					params: Params
			};

			export async function getStaticProps(context: GetStaticPropsContext) {
				const users = await promise(context.params);
				const res = { props: { users } };
				return res;
			}

			async function getData({ params }: { params: Params }) {
				const result = await getStaticProps({ params });
				
				if("redirect" in result) {
						redirect(result.redirect.destination);
				}
				
				if("notFound" in result) {
						notFound();
				}
				
				return "props" in result ? result.props : {};
			}

			export default async function Component({ params }: PageProps) {
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

		const actualOutput = transform(fileInfo, buildApi('tsx'));
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
			type Params = {
				[key: string]: string | string[] | undefined
			};
	
			type PageProps = {
					params: Params
			};
			
			export async function getStaticProps() {
				const allPosts = await promise;
				return { props: { allPosts } };
			}

			async function getData({ params }: { params: Params }) {
				const allPosts = await promise;
				return  { allPosts };
			}

			export default async function Component({ params }: PageProps) {
				const { allPosts: { edges } } = await getData({params});

				return edges.map(edge => <b>edge</b>)
			}
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));
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
			type Params = {
				[key: string]: string | string[] | undefined
			};

			type PageProps = {
					params: Params
			};

			export async function getStaticProps() {
				const users = await promise;
				const groups = await anotherPromise;

				return { props: { users, groups }, revalidate: 1 };
			}
			
			async function getData({ params }: { params: Params }) {
				const users = await promise;
				const groups = await anotherPromise;

				return { users, groups };
			}

			export default async function Component({ params }: PageProps) {
				const {users, groups } = await getData({ params });

				return [...users, ...groups].map(obj => <b>{obj}</b>)
			}

			export const revalidate = 1;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));
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
			type Params = {
				[key: string]: string | string[] | undefined
			};

			type PageProps = {
					params: Params
			};

			export async function getStaticProps() {
				const users = await promise;
				return { props: { users } };
			}
			
			async function getData({ params }: { params: Params }) {
				const users = await promise;
				return { users };
			}

			async function SingleAppPage({ params }: PageProps) {
				const props = await getData({ params });
				return null;
			}

			export default SingleAppPage;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should inject data fetching function when export keyword is used', function () {
		const INPUT = `
			export async function getStaticProps() {
				return { props: { a } };
			}

			export function SingleAppPage(props: inferSSRProps<typeof getStaticProps>) {
					return null;
			}
			
			export default SingleAppPage;
			
	    `;

		const OUTPUT = `
			type Params = {
				[key: string]: string | string[] | undefined
			};

			type PageProps = {
				params: Params
			};

			export async function getStaticProps() {
				return { props: { a } };
			}

			async function getData({ params }: { params: Params }) {
				return { a } ;
			}
			
			export async function SingleAppPage({ params }: PageProps) {
				const props = await getData({ params });
				return null;
			}

			export default SingleAppPage;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));
		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should inject data fetching function when export keyword is used 2', function () {
		const INPUT = `
			export async function getStaticProps() {
				return { props: { a } };
			}

			export const SingleAppPage = (props: inferSSRProps<typeof getStaticProps>) => {
					return null;
			}
			
			export default SingleAppPage;
	    `;

		const OUTPUT = `
			type Params = {
				[key: string]: string | string[] | undefined
			};
	
			type PageProps = {
					params: Params
			};

			export async function getStaticProps() {
				return { props: { a } };
			}

			async function getData({ params }: { params: Params }) {
				return { a } ;
			}
			
			export const SingleAppPage = async ({ params }: PageProps) => {
				const props = await getData({ params });
				return null;
			}

			export default SingleAppPage;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));
		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should inject data fetching function when Page has 0 args', function () {
		const INPUT = `
			export async function getStaticProps() {
				sideEffect();
				return { props: { a } };
			}

			export const SingleAppPage = () => {
					return null;
			}
			
			export default SingleAppPage;
			
	    `;

		const OUTPUT = `
			type Params = {
				[key: string]: string | string[] | undefined
			};

			type PageProps = {
					params: Params
			};

			export async function getStaticProps() {
				sideEffect();
				return { props: { a } };
			}
			
			async function getData({ params }: { params: Params }) {
				sideEffect();
				return { a } ;
			}

			export const SingleAppPage = async ({ params }: PageProps) => {
				await getData({ params });
				return null;
			}
			
			export default SingleAppPage;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));
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
			type Params = {
				[key: string]: string | string[] | undefined
			};

			type PageProps = {
					params: Params
			};
		
			export async function getStaticProps() {
				const users = await promise;
				return { props: { users } };
			}
			
			async function getData({ params }: { params: Params }) {
				const users = await promise;
				return { users } ;
			}

			const Home = async ({ params }: PageProps) => {
				const { users } = await getData({ params });
				return (<Component users={users} />)
			};
			
			export default Home;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));
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
			
			type Params = {
				[key: string]: string | string[] | undefined
			};
	
			type PageProps = {
					params: Params
			};

			export async function getStaticProps() {
				const users = await promise;
				return { props: { users } };
			}
			
			async function getData({ params }: { params: Params }) {
				const users = await promise;
				return { users } ;
			}
			
			const Home = async ({ params }: PageProps) => {
				const { users } = await getData({ params });
				return (<><Component users={users} /></>)
			};
			
			export default Home;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));
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
			type Params = {
				[key: string]: string | string[] | undefined
			};
	
			type PageProps = {
					params: Params
			};

			export async function getStaticProps() {
				const users = await promise;
				return { props: { users } };
			}
			
			async function getData({ params }: { params: Params }) {
				const users = await promise;
				return { users } ;
			}

			const AppPage: AppPageType['default'] = async function AppPage({ params }: PageProps) {
				const props = await getData({ params });
				return null;
			};
			
			export default AppPage;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));
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
			type Params = {
				[key: string]: string | string[] | undefined
			};
	
			type PageProps = {
				params: Params
			};

			export async function getStaticProps() {
				const users = await promise;
				const groups = await anotherPromise;

				return { props: { users, groups }, revalidate: 1 };
			}

			async function getData({ params }: { params: Params }) {
				const users = await promise;
				const groups = await anotherPromise;
				return { users, groups } ;
			}

			export default async function Component({params}: PageProps) {
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

		const actualOutput = transform(fileInfo, buildApi('tsx'));

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
			
			type Params = {
				[key: string]: string | string[] | undefined
			};

			type PageProps = {
				params: Params
			};
		
			export async function getStaticProps() {
				const users = await promise;
				const groups = await anotherPromise;

				return { props: { users, groups }, revalidate: 1 };
			}
			
			async function getData({ params }: { params: Params }) {
				const users = await promise;
				const groups = await anotherPromise;
				return { users, groups } ;
			}
			
			export default async function Component({ params }: PageProps) {
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

		const actualOutput = transform(fileInfo, buildApi('tsx'));

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
			
			type Params = {
				[key: string]: string | string[] | undefined
			};

			type PageProps = {
					params: Params
			};

			export const getStaticProps = async () => {
				const users = await promise;
				const groups = await anotherPromise;

				return { props: { users, groups }, revalidate: 1 };
			}

			async function getData({ params }: { params: Params }) {
				const users = await promise;
				const groups = await anotherPromise;
				return { users, groups } ;
			}
			
			export default async function Component({ params }: PageProps) {
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

		const actualOutput = transform(fileInfo, buildApi('tsx'));

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
			import x from "y";
			
			type Params = {
				[key: string]: string | string[] | undefined
			};

			type PageProps = {
				params: Params
			};

			export const getStaticProps =  async () => {
				const users = await promise;
				const groups = await anotherPromise;

				if(false) {
					return { props: { users, groups }}
				}

				return { props: { users, groups }, revalidate: 1 };
			}
			
			async function getData({ params }: { params: Params }) {
				const users = await promise;
				const groups = await anotherPromise;
				
				if(false) {
					return  { users, groups }
				}
				
				return { users, groups } ;
			}

			export default async function Component({ params }: PageProps) {
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

		const actualOutput = transform(fileInfo, buildApi('tsx'));
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
			
			type Params = {
				[key: string]: string | string[] | undefined
			};

			type PageProps = {
					params: Params
			};
		
			export const getStaticProps = async () => {
				const users = await promise;
				const groups = await anotherPromise;

				if(false) {
					return { props: { users, groups }, revalidate: 1}
				}

				return { props: { users, groups }, revalidate: 1 };
			}
			
			async function getData({ params }: { params: Params }) {
				const users = await promise;
				const groups = await anotherPromise;
				
				if(false) {
					return  { users, groups }
				}
				
				return { users, groups } ;
			}

			export default async function Component({ params }: PageProps) {
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

		const actualOutput = transform(fileInfo, buildApi('tsx'));

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
			}
		`;

		const OUTPUT = `
			type Params = {
				[key: string]: string | string[] | undefined
			};
	
			type PageProps = {
				params: Params
			};
		
			export async function getServerSideProps() {
				const res = await fetch(\`https://...\`);
				const projects = await res.json();

				return { props: { projects } };
			}

			async function getData({ params }: { params: Params }) {
				const res = await fetch(\`https://...\`);
				const projects = await res.json();
				
				return { projects } ;
			}

			export default async function Dashboard({ params }: PageProps) {
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

		const actualOutput = transform(fileInfo, buildApi('tsx'));

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
		
			type Params = {
				[key: string]: string | string[] | undefined
			};

			type PageProps = {
					params: Params
			};
		
			export async function getStaticPaths() {
				return {
						paths: [{ params: { id: '1' } }, { params: { id: '2' } }],
									fallback: true,
				};
			}

			export async function generateStaticParams() {
				return (await getStaticPaths({})).paths;
			}

			export async function getStaticProps({ params }) {
				const res = await fetch(\`https://.../posts/\${params.id}\`);
				const post = await res.json();

				return { props: { post } };
			}

			async function getData({ params }: { params: Params }) {
				const res = await fetch(\`https://.../posts/\${params.id}\`);
				const post = await res.json();
				
				return { post } ;
			}

			export default async function Post({ params }: PageProps) {
				const {post} = await getData({params});

				return <PostLayout post={post} />;
			}

			export const dynamicParams = true;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));
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
			import PostLayout from '@/components/post-layout';
		
			type Params = {
				[key: string]: string | string[] | undefined
			};

			type PageProps = {
					params: Params
			};
			
			export async function getStaticPaths() {
				return {
						paths: [{ params: { id: '1' } }, { params: { id: '2' } }],
									fallback: false,
				};
			}

			export async function generateStaticParams() {
				return (await getStaticPaths({})).paths;
			}

			export async function getStaticProps({ params }) {
				const res = await fetch(\`https://.../posts/\${params.id}\`);
				const post = await res.json();

				return { props: { post } };
			}

			async function getData({ params }: { params: Params }) {
				const res = await fetch(\`https://.../posts/\${params.id}\`);
				const post = await res.json();
				
				return { post } ;
			}

			export default async function Post({ params }: PageProps) {
				const {post} = await getData({params});

				return <PostLayout post={post} />;
			}

			export const dynamicParams = false;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));
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
			import PostLayout from '@/components/post-layout';
		
			type Params = {
				[key: string]: string | string[] | undefined
			};

			type PageProps = {
					params: Params
			};

			export async function getStaticPaths() {
				return {
						paths: [{ params: { id: '1' } }, { params: { id: '2' } }],
									fallback: 'blocking',
				};
			}

			export async function generateStaticParams() {
				return (await getStaticPaths({})).paths;
			}

			export async function getStaticProps({ params }) {
				const res = await fetch(\`https://.../posts/\${params.id}\`);
				const post = await res.json();

				return { props: { post } };
			}

			async function getData({ params }: { params: Params }) {
				const res = await fetch(\`https://.../posts/\${params.id}\`);
				const post = await res.json();
				
				return { post } ;
			}

			export default async function Post({ params }: PageProps) {
				const {post} = await getData({params});

				return <PostLayout post={post} />;
			}

			export const dynamicParams = true;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));
		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should move the default export to the bottom of the file', function () {
		const INPUT = `
			import PostLayout from '@/components/post-layout';

			export default function Post({ post }) {
				return <PostLayout post={post} />;
			}

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
		`;

		const OUTPUT = `
			import PostLayout from '@/components/post-layout';
		
			type Params = {
				[key: string]: string | string[] | undefined
			};

			type PageProps = {
					params: Params
			};

			export async function getStaticPaths() {
				return {
						paths: [{ params: { id: '1' } }, { params: { id: '2' } }],
									fallback: 'blocking',
				};
			}

			export async function generateStaticParams() {
				return (await getStaticPaths({})).paths;
			}

			export async function getStaticProps({ params }) {
				const res = await fetch(\`https://.../posts/\${params.id}\`);
				const post = await res.json();

				return { props: { post } };
			}

			async function getData({ params }: { params: Params }) {
				const res = await fetch(\`https://.../posts/\${params.id}\`);
				const post = await res.json();
				
				return { post } ;
			}

			export default async function Post({ params }: PageProps) {
				const {post} = await getData({params});

				return <PostLayout post={post} />;
			}

			export const dynamicParams = true;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should wrap original getStaticProps when at least one of returnStatement argument is not ObjectExpression', function () {
		const INPUT = `
			export async function getStaticProps() {
				return fetchData();
			}

			export default function Component({ users }) {
				return users.map(user => <b>user</b>)
	          }
	      `;

		const OUTPUT = `
		import { notFound, redirect } from "next/navigation";
		type Params = {
			[key: string]: string | string[] | undefined
		};

		type PageProps = {
				params: Params
		};
		
			export async function getStaticProps() {
				return fetchData();
			}

			async function getData({ params }: { params: Params }) {
				const result = await getStaticProps({ params });
				
				if("redirect" in result) {
						redirect(result.redirect.destination);
				}
				
				if("notFound" in result) {
						notFound();
				}
				
				return "props" in result ? result.props : {};
		}

			export default async function Component({ params }: PageProps) {
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

		const actualOutput = transform(fileInfo, buildApi('tsx'));
		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
