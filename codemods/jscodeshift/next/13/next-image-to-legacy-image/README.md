# Next Image to Legacy Image

## Description

This codemod safely migrates existing Next.js 10, 11, 12 applications importing `next/image` to the renamed `next/legacy/image` import in Next.js 13 by replacing `next/image` imports with `next/legacy/image` and replacing `next/future/image` imports with `next/image`.

## Example

### Before

```jsx
import Image from 'next/image';
import FutureImage from 'next/future/image';

export default function Home() {
	return (
		<div>
			<Image src="/test.jpg" width="100" height="200" />
			<FutureImage src="/test.png" width="300" height="400" />
		</div>
	);
}
```

### After

```jsx
import Image from 'next/legacy/image';
import FutureImage from 'next/image';

export default function Home() {
	return (
		<div>
			<Image src="/test.jpg" width="100" height="200" />
			<FutureImage src="/test.png" width="300" height="400" />
		</div>
	);
}
```

## Applicability Criteria

## Links for more info

- https://nextjs.org/docs/pages/building-your-application/upgrading/codemods#next-image-to-legacy-image
