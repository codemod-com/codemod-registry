# Replace MSW handler signature

## Description

Following the original msw upgrade guide, the signature of the request handler have changed. This codemod hard replaces the callback signature to the new one and cleans up unused variables.

NOTE: This codemod should be applied after running all the other codemods present in the `upgrade-recipe` that are related to `req`, `res`, `ctx` objects. On its own, this codemod makes no sense to be run, and will most likely not do what you want.

## Example

### Before

```ts
import { http } from 'msw';

http.get('/resource', (req, res, ctx) => {
  return HttpResponse.json({ id: 'abc-123' });
});
```

### After

```ts
import { http } from 'msw';

http.get('/resource', () => {
  return HttpResponse.json({ id: 'abc-123' });
});
```

### Before

```ts
import { http } from 'msw';

http.get('/resource', (req, res, ctx) => {
  const userCookie = cookies.user;
  const url = new URL(request.url);

  doSomething(url);
  userCookie.doSomething();

  return HttpResponse.json({ id: 'abc-123' });
});
```

### After

```ts
import { http } from 'msw';

http.get('/resource', ({ request, cookies }) => {
  const userCookie = cookies.user;
  const url = new URL(request.url);

  doSomething(url);
  userCookie.doSomething();

  return HttpResponse.json({ id: 'abc-123' });
});
```

## Applicability Criteria

MSW version >= 2.0.0

## Other Metadata

### Codemod Version

v1.0.0

### Change Mode

**Assistive**: The automation partially completes changes. Human involvement is needed to make changes ready to be pushed and merged.

### **Codemod Engine**

[ts-morph](https://github.com/dsherret/ts-morph)

### Estimated Time Saving

~15 seconds per occurrence

### Owner

[Intuita](https://github.com/intuita-inc)

### Links for more info
-   https://mswjs.io/docs/migrations/1.x-to-2.x/#request-changes
