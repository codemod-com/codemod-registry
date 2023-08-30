# Ember Jquery Legacy

## Description

## Example

### Before:

```jsx
export default Component.extend({
click(event) {
  let nativeEvent = event.originalEvent;
}
});
```

### After:

```tsx
import { normalizeEvent } from "ember-jquery-legacy";

export default Component.extend({
click(event) {
  let nativeEvent = normalizeEvent(event);
}
});
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
