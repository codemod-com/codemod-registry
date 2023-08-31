# Object New Constructor

## Description

## Example

### Before:

```jsx
let obj1 = new EmberObject();
let obj2 = new EmberObject({ prop: 'value' });

const Foo = EmberObject.extend();
let foo = new Foo({ bar: 123 });
```

### After:

```tsx
let obj1 = EmberObject.create();
let obj2 = EmberObject.create({ prop: 'value' });

const Foo = EmberObject.extend();
let foo = new Foo({ bar: 123 });
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
