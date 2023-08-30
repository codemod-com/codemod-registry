# Deprecate Router Events

## Description

## Example

### Before:

```jsx
import Router from '@ember/routing/router';
import { inject as service } from '@ember/service';

export default Router.extend({
  currentUser: service('current-user'),

  willTransition(transition) {
    this._super(...arguments);
    if (!this.currentUser.isLoggedIn) {
      transition.abort();
      this.transitionTo('login');
    }
  },

  didTransition(privateInfos) {
    this._super(...arguments);
    ga.send('pageView', {
      pageName: privateInfos.name
    });
  }
});
```

### After:

```tsx
import Router from '@ember/routing/router';
import { inject as service } from '@ember/service';

export default Router.extend({
  currentUser: service('current-user'),

  init() {
    this._super(...arguments);

    this.on("routeWillChange", transition => {
      if (!this.currentUser.isLoggedIn) {
        transition.abort();
        this.transitionTo('login');
      }
    });

    this.on("routeDidChange", transition => {
      ga.send('pageView', {
        pageName: privateInfos.name
      });
    });
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
