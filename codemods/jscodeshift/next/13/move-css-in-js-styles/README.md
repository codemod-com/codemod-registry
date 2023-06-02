# move-css-in-js-styles

This codemod moves the CSS-in-JS styles into the CSS Modules.

## Example

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

gets transformed into:

```jsx
import styles from 'Head.module.css';

const Head = () => {
	return <head className={styles['wrapper']}></head>;
};

export default Head;
```

And the codemods creates the new file `Head.module.css` which contains:

```css
body {
	margin: 0;
	padding: 0;
}
```
