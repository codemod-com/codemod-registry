# remove-get-static-props
In the `pages` directory, the `getStaticProps` function is used to pre-render a page at build time by fetching data passing it down to the entire page as it is being generated during the build. However, the `app` directory data fetching will default to `cache: 'force-cache'`, which will cache the request data until manually invalidated.

The `remove-get-static-props` codemod replaces the `getStaticProps()` data fetching function in the `pages` directory with the new data fetching API in the `app` directory.

For example:
```jsx
// `pages` directory
 
export async function getStaticProps() {
  const res = await fetch(`https://...`);
  const projects = await res.json();
 
  return { props: { projects } };
}
 
export default function Index({ projects }) {
  return projects.map((project) => <div>{project.name}</div>);
}
```

Transforms into:
```jsx
// `app` directory
 
// This function can be named anything
async function getProjects() {
  const res = await fetch(`https://...`);
  const projects = await res.json();
 
  return projects;
}
 
export default async function Index() {
  const projects = await getProjects();
 
  return projects.map((project) => <div>{project.name}</div>);
}
```
