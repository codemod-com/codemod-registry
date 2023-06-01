# comment-deletable-files

This codemod adds a comment indicating which files should be deleted and migrated to different files during the migration process.

For example:

```jsx
import 'highlight.js/styles/default.css';
import 'swagger-ui-react/swagger-ui.css';

import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
	return <Component {...pageProps} />;
}

export default MyApp;
```

Transforms into:

```jsx
/*This file should be deleted. Please migrate its contents to appropriate files*/
import 'highlight.js/styles/default.css';
import 'swagger-ui-react/swagger-ui.css';

import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
	return <Component {...pageProps} />;
}

export default MyApp;
```
