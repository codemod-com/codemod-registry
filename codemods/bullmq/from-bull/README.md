# Bull to BullMQ

## Description

This codemod makes basic necessary changes to migrate from bull to bullmq. There is one change that you will absolutely have to make by yourself which is creating queue names for the queues that your application has. Then, these names will have to be used for the created workers in the files where you previously used `.process()`. Another manual change that has to be done is manual connection object correction as it can't be correctly inferred from all the possible options of assigning it. The syntax errors will be left intentionally. See examples below for better understanding.

## Example

### Before

```ts
worker.printHandlers()
```

### After

```ts
worker.listHandlers().forEach((handler) => {
  console.log(handler.info.header)
})
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

5 minutes per occurrence

### Owner

[Intuita](https://github.com/intuita-inc)

### Links for more info

-   https://mswjs.io/docs/migrations/1.x-to-2.x/#printhandlers


