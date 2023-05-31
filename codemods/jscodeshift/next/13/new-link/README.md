Safely removes `<a>` from `Link` components imported from `next/link` or adds the `legacyBehavior` prop on the component level.

For example:

```jsx
export default function Page() {
  return (
    <Link href="/about">
      <a>About Us</a>
    </Link>
  )
}
```

Transforms into:

```jsx
export default function Page() {
  return <Link href="/about">About Us</Link>
}
```
