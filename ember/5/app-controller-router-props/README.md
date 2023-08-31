# App Controller Router Props

## Description

## Example

### Before:

```jsx
import Controller from '@ember/controller';
import fetch from 'fetch';

export default Controller.extend({
	store: service('store'),

	actions: {
		sendPayload() {
			fetch('/endpoint', {
				method: 'POST',
				body: JSON.stringify({
					route: this.currentRouteName,
				}),
			});
		},
	},
});
```

### After:

```tsx
import Controller from '@ember/controller';
import fetch from 'fetch';

export default Controller.extend({
	router: service('router'),
	store: service('store'),

	actions: {
		sendPayload() {
			fetch('/endpoint', {
				method: 'POST',
				body: JSON.stringify({
					route: this.router.currentRouteName,
				}),
			});
		},
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
