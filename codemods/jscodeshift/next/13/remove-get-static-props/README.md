# remove-get-static-props

Data fetching methods such as `getStaticPaths`, `getServerSideProps`, `getStaticProps` are no longer available in the `app` directory.

This codemod creates comments indicating where to remove the deprecated `getStaticPaths()`, `getServerSideProps()`, `getStaticProps()` methods.

Additionally, it attempts to create boilerplate functions for retrieving server data and generating static params.

## Example:

```jsx
export const getStaticProps = async () => {
	return {
		props: {},
	};
};
```

gets transformed into:

```jsx
export const // TODO: remove this function
	getStaticProps = async () => {
		return {
			props: {},
		};
	};
```
