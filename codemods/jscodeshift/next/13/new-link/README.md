Safely removes `<a>` from `next/link` or adds `legacyBehavior` prop.

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
