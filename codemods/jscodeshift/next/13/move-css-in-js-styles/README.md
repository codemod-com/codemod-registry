# move-css-in-js-styles

This codemod moves CSS to CSS-in-JS styles.

For example:

```jsx
import RawHtml from './RawHtml';

const EmailHead = ({ title = '' }) => {
	return (
		<head>
			<title>{title}</title>
			<style type="text/css">
				{`
          #outlook a {
            padding: 0;
          }

          body {
            margin: 0;
            padding: 0;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
          }

          table,
          td {
            border-collapse: collapse;
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
          }

          img {
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
            -ms-interpolation-mode: bicubic;
          }

          p {
            display: block;
            margin: 13px 0;
          }
        `}
			</style>
		</head>
	);
};

export default EmailHead;
```

Transforms into:

```jsx
import styles from 'EmailHead.module.css';
/* eslint-disable @next/next/no-head-element */
import RawHtml from './RawHtml';

const EmailHead = ({ title = '' }) => {
	return (
		<head className={styles['wrapper']}>
			<title>{title}</title>
		</head>
	);
};

export default EmailHead;
```

And creates the new file `mailHead.module.css` which includes:

```jsx
  #outlook a {
    padding: 0;
  }

  body {
    margin: 0;
    padding: 0;
    -webkit-text-size-adjust: 100%;
    -ms-text-size-adjust: 100%;
  }

  table,
  td {
    border-collapse: collapse;
    mso-table-lspace: 0pt;
    mso-table-rspace: 0pt;
  }

  img {
    border: 0;
    height: auto;
    line-height: 100%;
    outline: none;
    text-decoration: none;
    -ms-interpolation-mode: bicubic;
  }

  p {
    display: block;
    margin: 13px 0;
  }
text/css
```
