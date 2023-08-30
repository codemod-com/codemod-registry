# Jquery Apis

## Description

## Example

## Events

### Before:

```jsx
import Component from '@ember/component';

export default Component.extend({
	waitForAnimation() {
		this.$().on('transitionend', () => this.doSomething());
	},
});
```

### After:

```tsx
import Component from '@ember/component';

export default Component.extend({
	waitForAnimation() {
		this.element.addEventListener('transitionend', () =>
			this.doSomething(),
		);
	},
});
```

## Query Selector

### Before:

```jsx
import Component from '@ember/component';

export default Component.extend({
	waitForAnimation() {
		this.$('.animated').on('transitionend', () => this.doSomething());
	},
});
```

### After:

```tsx
import Component from '@ember/component';

export default Component.extend({
	waitForAnimation() {
		this.element
			.querySelectorAll('.animated')
			.forEach((el) =>
				el.addEventListener('transitionend', () => this.doSomething()),
			);
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

~30 minutes per occurrence

### Owner

[Rajasegar Chandran](https://github.com/rajasegar)

### Links for more info
