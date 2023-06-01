# build-in-next-font

This codemod uninstalls `@next/font` and transforms `@next/font` imports into the built-in `next/font`.

For example:

```jsx
import { Inter } from '@next/font/google';
```

Transforms into:

```jsx
import { Inter } from 'next/font/google';
```
