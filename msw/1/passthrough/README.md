# Passthrough

## Description

This codemod **safely** transforms `req.passthrough()` to `passthrough()` and updates import statement as needed.

## Examples

### Before

```ts
import { rest } from 'msw';
rest.get('/resource', () => {
	return req.passthrough();
});
```

### After: intrinsic

```ts
import { rest, passthrough } from 'msw';
rest.get('/resource', () => {
	return passthrough();
});
```

## Applicability Criteria

msw version lower or equal to 1.

## Other Metadata

### Codemod Version

v1.0.0

### Change Mode

**Autonomous**: The automation fully completes changes.

### **Codemod Engine**

jscodeshift

### Estimated Time Saving

~5 minutes per occurrence

### Owner

[Intuita](https://github.com/intuita-inc)

### Links for more info

-   https://github.com/mswjs/msw/blob/feat/standard-api/MIGRATING.md#reqpassthrough
