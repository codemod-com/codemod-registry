# build-in-next-font

This codemod transforms the module specifier `@next/font/*` in import statements into `next/font/*`.

Using the `@next/font/*` modules is deprecated since Next.js v13.2.

## Example:

```jsx
import { Inter } from '@next/font/google';
```

gets transformed into:

```jsx
import { Inter } from 'next/font/google';
```
