# remove-get-static-props

The `getStaticProps` function is no longer available in the `app` directory.

This codemod creates comments indicating where to remove the deprecated `getStaticProps()` functions.

Additionally, it attemps to create boileplate functions for retrieving static properties.

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
