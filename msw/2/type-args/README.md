# Replace MSW handler signature

## Description

There is a change to generic type interface of rest.method() calls. This codemod puts the generic arguments in the correct order to keep type safety.

## Example

### Before

```ts
rest.get<PathParamsType, ReqBodyType>('/resource', (req, res, ctx) => {
  return res(ctx.json({ firstName: 'John' }));
});
```

### After

```ts
rest.get<ReqBodyType, PathParamsType>('/resource', (req, res, ctx) => {
  return res(ctx.json({ firstName: 'John' }));
});
```

### Before

```ts
rest.get<PathParamsType>('/resource', (req, res, ctx) => {
  return res(ctx.json({ firstName: 'John' }));
});
```

### After

```ts
rest.get<any, PathParamsType>('/resource', (req, res, ctx) => {
  return res(ctx.json({ firstName: 'John' }));
});
```

## Applicability Criteria

MSW version >= 2.0.0

## Other Metadata

### Codemod Version

v1.0.0

### Change Mode

**Autonomous**: Changes can safely be pushed and merged without further human involvement.

### **Codemod Engine**

[ts-morph](https://github.com/dsherret/ts-morph)

### Estimated Time Saving

~15 seconds per occurrence

### Owner

[Intuita](https://github.com/intuita-inc)

### Links for more info
