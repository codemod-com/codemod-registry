# replace-next-router

To migrate to the App Router, the new `useRouter` hook is imported from `next/navigation` and has different behavior compared to the `useRouter` hook in pages which is imported from `next/router`.

This codemod allows you to migrate the `useRouter` hook to the new `useRouter` hook imported from `next/navigation`. This includes all usages of the useRouter() calls which may be replaced with useSearchParams and usePathname.

For example:

```jsx
import { useRouter } from 'next/router';
```

Can be transformed to:

```jsx
import { useRouter } from 'next/navigation';
```

And in some cases, it might get transformed any/some/all of the following:

```jsx
import { usePathname } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
```
