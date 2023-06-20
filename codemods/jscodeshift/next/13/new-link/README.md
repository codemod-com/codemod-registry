# New Link

## Description

Safely removes `<a>` from `Link` components imported from the `next/link` module or adds the `legacyBehavior` prop on the component level.

## Example

### Before running codemod:

```jsx
export default function Component() {
	return (
		<Link href="/a">
			<a>Anchor</a>
		</Link>
	);
}
```

### After running codemod:

```jsx
export default function Component() {
	return <Link href="/a">Anchor</Link>;
}
```

## Applicability Criteria

## Links for more info

- https://nextjs.org/docs/pages/building-your-application/upgrading/codemods#new-link