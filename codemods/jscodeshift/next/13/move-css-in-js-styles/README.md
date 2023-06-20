# Move Css in Js Styles

## Description

This codemod moves the CSS-in-JS styles into the CSS Modules.

## Example

### Before

```jsx
const Head = () => {
	return (
		<head>
			<style type="text/css">
				{`
        body {
          margin: 0;
          padding: 0;
        }
      `}
			</style>
		</head>
	);
};

export default Head;
```

### After

The file gets transformed into:

```jsx
import styles from 'Head.module.css';

const Head = () => {
	return <head className={styles['wrapper']}></head>;
};

export default Head;
```

And the codemod creates the new file `Head.module.css` which contains:

```jsx
body {
	margin: 0;
	padding: 0;
}
```

## Applicability Criteria

## Links for more info

- https://nextjs.org/docs/pages/building-your-application/styling/css-in-js
