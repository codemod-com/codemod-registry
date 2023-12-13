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

### Before

First sentence of the before block.
Second sentence of the before block.
Third sentence of the before block.

### After
First sentence of the after block.
Second sentence of the after block.
Third sentence of the after block.
`;

describe('parse', function () {
	it('should parse', async function () {
		const obj = await parse(DATA);

		console.log(obj);
	});
});
