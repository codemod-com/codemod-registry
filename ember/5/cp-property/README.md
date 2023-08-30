# Cp Property

## Description

## Example

### Before:

```jsx
const Person = EmberObject.extend({
  fullName: computed(function() {
    return `${this.firstName} ${this.lastName}`;
  }).property('firstName', 'lastName')
});
```

### After:

```tsx
const Person = EmberObject.extend({
  fullName: computed('firstName', 'lastName', function() {
    return `${this.firstName} ${this.lastName}`;
  })
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
