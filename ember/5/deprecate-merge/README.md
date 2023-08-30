# Deprecate Merge

## Description

## Example

### Before:

```jsx
import { merge } from '@ember/polyfills';

var a = { first: 'Yehuda' };
var b = { last: 'Katz' };
merge(a, b);
```

### After:

```tsx
import { assign } from '@ember/polyfills';

var a = { first: 'Yehuda' };
var b = { last: 'Katz' };
assign(a, b);
```

## Applicability Criteria

## Other Metadata

### Codemod Version

v1.0.0

### Change Mode

**Autonomous**: Changes can safely be pushed and merged without further human involvement.

### **Codemod Engine**

jscodeshift

### Estimated Time Saving

~30 minutes per occurrence

### Owner

[Rajasegar Chandran](https://github.com/rajasegar)

### Links for more info