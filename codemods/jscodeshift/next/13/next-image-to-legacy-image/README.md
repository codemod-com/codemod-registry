# next-image-to-legacy-image

This codemod safely migrates existing Next.js 10, 11, 12 applications importing `next/image` to the renamed `next/legacy/image` import in Next.js 13 by replacing `next/image` imports with `next/legacy/image` and replacing `next/future/image` imports with `next/image`.

## Example:

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

gets transformed into:

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
