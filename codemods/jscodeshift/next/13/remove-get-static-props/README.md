# remove-get-static-props
The `app` directory deprecates the `getStaticProps()` data fetching function in the `pages` directory.

This codemod creates comments indicating where to remove the deprecated `getStaticProps()` functions.

For example:
```jsx
export const getStaticProps = async () => {
  return {
    props: {
      ...(await serverSideTranslations("en", ["common"])),
    },
  };
};
```

Transforms into:
```jsx
export const // TODO: remove this function
getStaticProps = async () => {
  return {
    props: {
      ...(await serverSideTranslations("en", ["common"])),
    },
  };
};
```
