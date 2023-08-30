# Jquery Event

## Description

## Example

### Before:

```jsx
// your event handler:
export default Component.extend({
click(event) {
  let x = event.originalEvent.clientX;
}
});
```

### After:

```tsx
// your event handler:
export default Component.extend({
click(event) {
  let x = event.clientX;
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
