# replace-next-router

Since Next.js 13.4, you can use the following hooks from the `next/navigation` module:

-   `useRouter`,
-   `useSearchParams`,
-   `usePathname`,
-   `useParams`.

These hooks replace the functionality available in the `useRouter` hook in the `next/hook` module, however, the behavior is distinct.

This codemod allows you to migrate the `useRouter` hook to the new `useRouter` hook imported from `next/navigation`. This includes all usages of the `useRouter` hook which may be replaced with `useSearchParams` and `usePathname`.

## Example:

```jsx
import { useRouter } from 'next/router';

function Component() {
	const { query } = useRouter();
	const { a, b, c } = query;
}
```

gets transformed to:

```jsx
import { useSearchParams } from 'next/navigation';

function Component() {
	const searchParams = useSearchParams();
	const a = searchParams?.get('a');
	const b = searchParams?.get('b');
	const c = searchParams?.get('c');
}
```
