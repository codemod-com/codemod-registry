# Cp Volatile

## Description

## Example

### Before:

```jsx
const Person = EmberObject.extend({
	fullName: computed(function () {
		return `${this.firstName} ${this.lastName}`;
	}).volatile(),
});
```

### After:

```tsx
const Person = EmberObject.extend({
	get fullName() {
		return `${this.firstName} ${this.lastName}`;
	},
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

~5 minutes per occurrence

### Owner

[Rajasegar Chandran](https://github.com/rajasegar)

### Links for more info

-   https://github.com/ember-codemods/ember-3x-codemods/blob/master/transforms/cp-volatile
