import { describe, it } from 'vitest';
import { parse } from './parse.js';

const DATA = `
# Name

## Description

First sentence of description.
Second sentence of description.
Third sentence of description.

List:
- a
- b
- c

## Example
`;

describe('parse', function () {
	it('should parse', async function () {
		await parse(DATA);
	});
});
