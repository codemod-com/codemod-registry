# Array Wrapper

## Description

## Example

### Before:

```jsx
import { A } from '@ember/array';
let arr = new A();
```

### After:

```tsx
import { A as emberA } from '@ember/array';
let arr = A();
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
