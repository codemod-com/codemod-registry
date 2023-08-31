# Tracked Properties

## Description

## Example

### Before:

```jsx
import Component from '@ember/component';
import { computed, get } from '@ember/object';

export default class Foo extends Component {
    bar;
    baz = 'barBaz';

    @computed('baz')
    get bazInfo() {
    return \`Name: ${get(this, 'baz')}\`;
    }
}
```

### After:

```tsx
import { tracked } from '@glimmer/tracking';
import Component from '@ember/component';
import { computed, get } from '@ember/object';

export default class Foo extends Component {
    bar;
    @tracked baz = 'barBaz';

    get bazInfo() {
    return \`Name: ${get(this, 'baz')}\`;
    }
}
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
