# Remove Get Static Props

## Description

Data fetching methods such as `getStaticPaths`, `getServerSideProps`, `getStaticProps` are no longer available in the `app` directory.

This codemod creates comments indicating where to remove the deprecated `getStaticPaths()`, `getServerSideProps()`, `getStaticProps()` methods.

Additionally, it attempts to create boilerplate functions for retrieving server data and generating static params.

## Example

### Before

```jsx
export const getStaticProps = async () => {
	return {
		props: {},
	};
};
```

### After

```jsx
export const // TODO: remove this function
	getStaticProps = async () => {
		return {
			props: {},
		};
	};
```

## Applicability Criteria

Next.js version is greater or equal to 13.4.

## Other Metadata

### Codemod Version

v1.0.0

### Change Mode

**Assistive**: automation partially complete changes. human involvement is needed to make changes ready to be pushed and merged.

### **Codemod Engine**

jscodeshift

### Estimated Time Saving

~2 minutes per occurrence

### Owner

Intuita

### Links for more info

- https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration#static-site-generation-getstaticprops
