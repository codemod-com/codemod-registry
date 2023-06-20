# Remove Get Static Props

## Description

Data fetching methods such as `getStaticPaths`, `getServerSideProps`, `getStaticProps` are no longer available in the `app` directory.

This codemod creates comments indicating where to remove the deprecated `getStaticPaths()`, `getServerSideProps()`, `getStaticProps()` methods.

Additionally, it attempts to create boilerplate functions for retrieving server data and generating static params.

## Example

### Before running codemod:

```jsx
export const getStaticProps = async () => {
	return {
		props: {},
	};
};
```

### After running codemod:

```jsx
export const // TODO: remove this function
	getStaticProps = async () => {
		return {
			props: {},
		};
	};
```

## Applicability Criteria

## Links for more info

- https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration#static-site-generation-getstaticprops