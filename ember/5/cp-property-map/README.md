# Cp Property Map

## Description

## Example

### Before:

```jsx
const Person = EmberObject.extend({
	friendNames: map('friends', function (friend) {
		return friend[this.get('nameKey')];
	}).property('nameKey'),
});
```

### After:

```tsx
const Person = EmberObject.extend({
	friendNames: map('friends', ['nameKey'], function (friend) {
		return friend[this.get('nameKey')];
	}),
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
