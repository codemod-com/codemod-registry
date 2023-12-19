import { vi, afterEach, beforeEach, describe, it } from 'vitest';
import { convertToYaml, parse } from './parse.js';
import { deepEqual } from 'assert';
import { createHash } from 'crypto';

const DATA = `
# Do the thing

## Description

This is an amazing codemod

### WARNING

This codemod does the thing

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
				'### tsconfig.json\n' +
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
---
created-on: ${date.toISOString()}
f_long-description: >-
  ## Description
  \n
  \n
  This is an amazing codemod
  ### WARNING
  This codemod does the thing
  \n
  \n
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
f_vs-code-link: vscode://intuita.intuita-vscode-extension/cases/${vscodeHashDigest}
f_codemod-studio-link: n/a
f_cli-command: intuita msw/2/imports
f_framework: cms/framework/msw.md
f_applicability-criteria: MSW >= 1.0.0
f_verified-codemod: true
f_author: cms/authors/intuita.md
layout: "[automations].html"
slug: msw-2-imports
title: Do the thing
f_slug-name: msw-2-imports
f_codemod-engine: cms/codemod-engines/ts-morph.md
f_change-mode-2: Assistive
f_estimated-time-saving: 5 minutes/occurrence
tags: automations
updated-on: ${date.toISOString()}
published-on: ${date.toISOString()}
seo: n/a
---
`.trim(),
		);
	});
});
