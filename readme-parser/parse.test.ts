import { vi, afterEach, beforeEach, describe, it } from 'vitest';
import { convertToYaml, parse } from './parse.js';
import { deepEqual } from 'assert';
import { createHash } from 'crypto';

const DATA = `
# Do the thing

## Description

This is an amazing codemod which does \`the thing\`

### WARNING

This codemod does the thing

Following the original msw [upgrade guide](https://mswjs.io/docs/migrations/1.x-to-2.x/#imports), there are certain imports that changed their location and/or naming. This codemod will adjust your imports to the new location and naming.

-   \`setupWorker\` is now imported from \`msw/browser\`
-   \`rest\` from \`msw\` is now named \`http\`
-   \`RestHandler\` from \`msw\` is now named \`HttpHandler\`

## Example

### \`tsconfig.json\`

### Before

\`\`\`ts
http.get<ReqBodyType, PathParamsType>('/resource', (req, res, ctx) => {
  return res(ctx.json({ firstName: 'John' }));
});
\`\`\`

### After

\`\`\`ts
http.get<PathParamsType, ReqBodyType>('/resource', (req, res, ctx) => {
  return res(ctx.json({ firstName: 'John' }));
});
\`\`\`

### Before

\`\`\`ts
http.get<ReqBodyType>('/resource', (req, res, ctx) => {
  return res(ctx.json({ firstName: 'John' }));
});
\`\`\`

### After

\`\`\`ts
http.get<any, ReqBodyType>('/resource', (req, res, ctx) => {
  return res(ctx.json({ firstName: 'John' }));
});
\`\`\`

## Applicability Criteria

\`MSW\` >= 1.0.0

## Other Metadata

### Codemod Version

v1.0.0

### Change Mode

**Assistive**: The automation partially completes changes. Human involvement is needed to make changes ready to be pushed and merged.

### **Codemod Engine**

[ts-morph](https://github.com/dsherret/ts-morph)

### Estimated Time Saving

5 minutes per occurrence
Maybe more...

### Owner

[The Author](https://github.com/author)

### Links for more info

- [Link1](https://example.com/)
- [Link2](https://example1.com/)
`;

// const DATA = `
// # Auth Decoder

// ## Description

// This codemod for RedwoodJS v4 automatically inserts an \`authDecoder\` property into the \`createGraphQLHandler\` call if it's not already present. It also adds an import statement for \`authDecoder\` from \`@redwoodjs/auth-auth0-api\` at the beginning of the file, ensuring that the necessary functionality for authentication is correctly integrated.

// ## Example

// ### Before

// \`\`\`ts
// import { createGraphQLHandler } from '@redwoodjs/graphql-server';

// import directives from 'src/directives/**/*.{js,ts}';
// import sdls from 'src/graphql/**/*.sdl.{js,ts}';
// import services from 'src/services/**/*.{js,ts}';

// import { db } from 'src/lib/db';
// import { logger } from 'src/lib/logger';

// export const handler = createGraphQLHandler({
//   loggerConfig: { logger, options: {} },
//   directives,
//   sdls,
//   services,
//   onException: () => {
//     // Disconnect from your database with an unhandled exception.
//     db.$disconnect();
//   },
// });
// \`\`\`

// ### After

// \`\`\`ts
// import { authDecoder } from '@redwoodjs/auth-auth0-api';
// import { createGraphQLHandler } from '@redwoodjs/graphql-server';

// import directives from 'src/directives/**/*.{js,ts}';
// import sdls from 'src/graphql/**/*.sdl.{js,ts}';
// import services from 'src/services/**/*.{js,ts}';

// import { db } from 'src/lib/db';
// import { logger } from 'src/lib/logger';

// export const handler = createGraphQLHandler({
//   authDecoder: authDecoder,
//   loggerConfig: { logger, options: {} },
//   directives,
//   sdls,
//   services,

//   onException: () => {
//     // Disconnect from your database with an unhandled exception.
//     db.$disconnect();
//   }
// });
// \`\`\`

// ## Applicability Criteria

// RedwoodJS < v4.0.0

// ## Other Metadata

// ### Codemod Version

// v1.0.0

// ### Change Mode

// **Assistive**: The automation partially completes changes. Human involvement is needed to make changes ready to be pushed and merged.

// ### **Codemod Engine**

// [jscodeshift](https://github.com/facebook/jscodeshift)

// ### Estimated Time Saving

// ~6 minutes per occurrence

// ### Owner

// [Rajasegar Chandran](https://github.com/rajasegar)
// `;

describe('parse/yaml', function () {
	const parseResult = parse(DATA);

	it('should parse correctly', async function () {
		deepEqual(parseResult, {
			name: 'Do the thing',
			description:
				'This is an amazing codemod which does `the thing`\n\n### WARNING\n\nThis codemod does the thing\n' +
				'Following the original msw [upgrade guide](https://mswjs.io/docs/migrations/1.x-to-2.x/#imports), ' +
				'there are certain imports that changed their location and/or naming. This codemod will adjust your imports to the new location and naming.\n' +
				'-   `setupWorker` is now imported from `msw/browser`\n' +
				'-   `rest` from `msw` is now named `http`\n' +
				'-   `RestHandler` from `msw` is now named `HttpHandler`',
			examples:
				'\n### tsconfig.json\n\n' +
				'### Before\n\n' +
				'```ts\n\n' +
				"http.get<ReqBodyType, PathParamsType>('/resource', (req, res, ctx) => {\n" +
				"  return res(ctx.json({ firstName: 'John' }));\n" +
				'});\n\n' +
				'```\n\n' +
				'### After\n\n' +
				'```ts\n\n' +
				"http.get<PathParamsType, ReqBodyType>('/resource', (req, res, ctx) => {\n" +
				"  return res(ctx.json({ firstName: 'John' }));\n" +
				'});\n\n' +
				'```\n\n' +
				'### Before\n\n' +
				'```ts\n\n' +
				"http.get<ReqBodyType>('/resource', (req, res, ctx) => {\n" +
				"  return res(ctx.json({ firstName: 'John' }));\n" +
				'});\n\n' +
				'```\n\n' +
				'### After\n\n' +
				'```ts\n\n' +
				"http.get<any, ReqBodyType>('/resource', (req, res, ctx) => {\n" +
				"  return res(ctx.json({ firstName: 'John' }));\n" +
				'});\n\n' +
				'```',
			applicability: '`MSW` >= 1.0.0',
			version: '1.0.0',
			changeMode: 'assistive',
			engine: 'ts-morph',
			timeSave: '5 minutes/occurrence\nMaybe more...',
			owner: 'The Author',
			links: 'https://example.com/,https://example1.com/',
		});
	});

	it('should output correct YAML', async function () {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		// 5th Dec 2023
		const date = new Date(2023, 11, 5);
		vi.setSystemTime(date);

		const yaml = convertToYaml(
			parseResult,
			'codemods/msw/2/imports/README.md',
		);

		const vscodeHashDigest = createHash('ripemd160')
			.update('msw/2/imports')
			.digest('base64url');

		deepEqual(
			yaml,
			`
created-on: ${date.toISOString()}
f_long-description: >-
  ## Description
  

  This is an amazing codemod which does \`the thing\`
  
  ### WARNING
  
  This codemod does the thing
  Following the original msw [upgrade guide](https://mswjs.io/docs/migrations/1.x-to-2.x/#imports), there are certain imports that changed their location and/or naming. This codemod will adjust your imports to the new location and naming.
  -   \`setupWorker\` is now imported from \`msw/browser\`
  -   \`rest\` from \`msw\` is now named \`http\`
  -   \`RestHandler\` from \`msw\` is now named \`HttpHandler\`
  

  
  ### tsconfig.json
  
  ### Before
  
  \`\`\`ts
  
  http.get<ReqBodyType, PathParamsType>('/resource', (req, res, ctx) => {
    return res(ctx.json({ firstName: 'John' }));
  });
  
  \`\`\`
  
  ### After
  
  \`\`\`ts
  
  http.get<PathParamsType, ReqBodyType>('/resource', (req, res, ctx) => {
    return res(ctx.json({ firstName: 'John' }));
  });
  
  \`\`\`
  
  ### Before
  
  \`\`\`ts
  
  http.get<ReqBodyType>('/resource', (req, res, ctx) => {
    return res(ctx.json({ firstName: 'John' }));
  });
  
  \`\`\`
  
  ### After
  
  \`\`\`ts
  
  http.get<any, ReqBodyType>('/resource', (req, res, ctx) => {
    return res(ctx.json({ firstName: 'John' }));
  });
  
  \`\`\`
f_github-link: https://github.com/intuita-inc/codemod-registry/tree/main/codemods/msw/2/imports
f_vs-code-link: vscode://intuita.intuita-vscode-extension/showCodemod?chd=${vscodeHashDigest}
f_cli-command: intuita msw/2/imports
f_framework: cms/framework/msw.md
f_applicability-criteria: \`MSW\` >= 1.0.0
f_verified-codemod: false
f_author: cms/authors/the-author.md
layout: "[automations].html"
slug: msw-2-imports
title: Msw V2 - Do the thing
f_slug-name: msw-2-imports
f_codemod-engine: cms/codemod-engines/ts-morph.md
f_change-mode-2: Assistive
f_estimated-time-saving: >-
  5 minutes/occurrence
  Maybe more...
tags: automations
updated-on: ${date.toISOString()}
published-on: ${date.toISOString()}
seo:
  title: Msw V2 - Do the thing | Intuita Automations
  og:title: Msw V2 - Do the thing | Intuita Automations
  twitter:title: Msw V2 - Do the thing | Intuita Automations
  description: This is an amazing codemod which does \`the thing\`
  twitter:card: This is an amazing codemod which does \`the thing\`
	`.trim(),
		);
	});
});
