# Replace MSW Imports

## Description

Following the original msw [upgrade guide](https://mswjs.io/docs/migrations/1.x-to-2.x/#imports), there are certain imports that changed their location and/or naming. This codemod will import correct objects from appropriate paths to start your msw migration path.

-   `setupWorker` is now imported from `msw/browser`
-   `rest` from `msw` is now named `http`
-   `RestHandler` from `msw` is now named `HttpHandler`

## Example

### Before

```ts
import { setupWorker, rest as caller, RestHandler } from 'msw';

const handlers: RestHandler[] = [
  caller.get('/user', (req, res, ctx) => {
    return res(ctx.json({ firstName: 'John' }));
  }),
]
```

### After

```ts
import { setupWorker } from 'msw/browser';
import { http as caller, HttpHandler } from 'msw';

const handlers: HttpHandler[] = [
  caller.get('/user', (req, res, ctx) => {
    return res(ctx.json({ firstName: 'John' }));
  }),
]
```

## Applicability Criteria

MSW version >= 1.0.0

## Other Metadata

### Codemod Version

v1.0.0

### Change Mode

**Autonomous**: Changes can safely be pushed and merged without further human involvement.

### **Codemod Engine**

[ts-morph](https://github.com/dsherret/ts-morph)

### Estimated Time Saving

~1 minute per occurrence

### Owner

[Intuita](https://github.com/intuita-inc)

### Links for more info

-   https://mswjs.io/docs/migrations/1.x-to-2.x/#imports
