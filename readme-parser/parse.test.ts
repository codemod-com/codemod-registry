import { describe, it } from 'vitest';
import { convertToYaml, parse } from './parse.js';
import { deepEqual } from 'assert';

const DATA = `
# Do the thing

## Description

This is an amazing codemod

### WARNING

This codemod does the thing

## Example

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

### Owner

[Intuita](https://github.com/intuita-inc)

### Links for more info

- [Link1](https://example.com/)
- [Link2](https://example1.com/)
`;

describe('parse/yaml', function () {
	const parseResult = parse(DATA);

	it('should parse correctly', async function () {
		deepEqual(parseResult, {
			name: 'Do the thing',
			description:
				'This is an amazing codemod\n### WARNING\nThis codemod does the thing',
			examples:
				'### Before\n' +
				'```ts\n' +
				"http.get<ReqBodyType, PathParamsType>('/resource', (req, res, ctx) => {\n" +
				"  return res(ctx.json({ firstName: 'John' }));\n" +
				'});\n' +
				'```\n' +
				'### After\n' +
				'```ts\n' +
				"http.get<PathParamsType, ReqBodyType>('/resource', (req, res, ctx) => {\n" +
				"  return res(ctx.json({ firstName: 'John' }));\n" +
				'});\n' +
				'```\n' +
				'### Before\n' +
				'```ts\n' +
				"http.get<ReqBodyType>('/resource', (req, res, ctx) => {\n" +
				"  return res(ctx.json({ firstName: 'John' }));\n" +
				'});\n' +
				'```\n' +
				'### After\n' +
				'```ts\n' +
				"http.get<any, ReqBodyType>('/resource', (req, res, ctx) => {\n" +
				"  return res(ctx.json({ firstName: 'John' }));\n" +
				'});\n' +
				'```',
			applicability: 'MSW >= 1.0.0',
			version: '1.0.0',
			changeMode: 'assistive',
			engine: 'ts-morph',
			timeSave: '5 minutes/occurrence',
			owner: 'Intuita',
			links: 'https://example.com/,https://example1.com/',
		});
	});

	it('should output correct YAML', async function () {
		const yaml = convertToYaml(parseResult);

		deepEqual(
			yaml,
			`
---
created-on: -
f_long-description: |-
  ## Description
  This is an amazing codemod
  ### WARNING
  This codemod does the thing
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
f_github-link: -
f_vs-code-link: -
f_codemod-studio-link: -
f_cli-command: -
f_framework: -
f_applicability-criteria: MSW >= 1.0.0
f_verified-codemod: true
f_author: -
layout: "[automations].html"
slug: -
title: Do the thing
updated-on: -
published-on: -
f_slug-name: -
f_codemod-engine: cms/codemod-engines/ts-morph.md
f_change-mode-2: Assistive
f_estimated-time-saving: 5 minutes/occurrence
tags: automations
seo: -
---
`.trim(),
		);
	});
});
