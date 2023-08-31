# Cp Property

## Description

## Example

### Before:

```jsx
const Person = EmberObject.extend({
	fullName: computed(function () {
		return `${this.firstName} ${this.lastName}`;
	}).property('firstName', 'lastName'),
});
```

### After:

```tsx
const Person = EmberObject.extend({
	fullName: computed('firstName', 'lastName', function () {
		return `${this.firstName} ${this.lastName}`;
	}),
});
```

## Applicability Criteria

Ember.js version higher or equal to 3.

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

-   https://github.com/ember-codemods/ember-3x-codemods/blob/master/transforms/cp-property
