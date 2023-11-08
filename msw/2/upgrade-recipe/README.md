# MSW migration recipe

## Description

This recipe is a set of codemods that will upgrade your project from using msw v1 to v2.

The recipe includes the following codemods:

-   [imports](https://github.com/intuita-inc/codemod-registry/tree/main/msw/2/imports)
-   [request-changes](https://github.com/intuita-inc/codemod-registry/tree/main/msw/2/request-changes)
-   [ctx-fetch](https://github.com/intuita-inc/codemod-registry/tree/main/next/13/ctx-fetch)
-   [req-passthrough](https://github.com/intuita-inc/codemod-registry/tree/main/next/13/req-passthrough)
-   [response-usages](https://github.com/intuita-inc/codemod-registry/tree/main/next/13/response-usages)
-   [lifecycle-events-signature](https://github.com/intuita-inc/codemod-registry/tree/main/next/13/lifecycle-events-signature)
-   [print-handler](https://github.com/intuita-inc/codemod-registry/tree/main/next/13/print-handler)
-   [type-args](https://github.com/intuita-inc/codemod-registry/tree/main/next/13/type-args)
-   [callback-signature](https://github.com/intuita-inc/codemod-registry/tree/main/next/13/callback-signature)

## Applicability Criteria

MSW version >= 2.0.0

## Other Metadata

TODO: [config changes](https://mswjs.io/docs/migrations/1.x-to-2.x/#frequent-issues)

### Codemod Version

v1.0.0

### Change Mode

**Autonomous**: Changes can safely be pushed and merged without further human involvement.

### Estimated Time Saving

Depending on the size of the project, this recipe can save up to 30 minutes and more.

### Owner

[Intuita](https://github.com/intuita-inc)

### Links for more info

-   https://mswjs.io/docs/migrations/1.x-to-2.x/
