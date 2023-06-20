# Built in Next Font

## Description

This codemod transforms the module specifier `@next/font/*` in import statements into `next/font/*`.

Using the `@next/font/*` modules is deprecated since Next.js v13.2.

## Example

### Before running codemod:

```jsx
import { Inter } from '@next/font/google';
```

### After running codemod:

```jsx
import { Inter } from 'next/font/google';
```

## Applicability Criteria

## Links for more info

- https://nextjs.org/docs/pages/building-your-application/upgrading/codemods#use-built-in-font
