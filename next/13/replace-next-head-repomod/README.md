# Replace Next Head Repomod

## Description

Generates a static metadata object based on meta tags managed by next/head. Marks the meta tags that can be deleted.

## Example:

### Before:
```jsx
import Head from 'next/head';
export default function Page() {
	return (
		<>
			<Head>
				<title>My page title</title>
			</Head>
		</>
	);
}
```

### After:
```jsx
import { Metadata } from 'next';
import Head from 'next/head';
export const metadata: Metadata = {
	title: `My page title`,
};
export default function Page() {
	return (
		<>
			<Head>
				{/* this tag can be removed */}
				<title>My page title</title>
			</Head>
		</>
	);
}
```

## Applicability Criteria

Next.js version higher or equal to 13.

## Other Metadata

### Codemod Version

v1.0.0

### Change Mode

**Assistive**: The automation partially completes changes. Human involvement is needed to make changes ready to be pushed and merged.

### **Codemod Engine**

Intuita File Transformation Engine

### Estimated Time Saving

~5 minutes per occurrence

### Owner

[Vercel](https://github.com/vercel)

### Links for more info

-   https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration#step-3-migrating-nexthead
