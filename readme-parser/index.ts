#!/usr/bin/env node

import { readFileSync } from 'fs';
import { convertToYaml, parse } from './parse.js';

function accept() {
	const path = process.argv.at(-1);

	if (!path) {
		throw new Error('No filepath passed');
	}

	const data = readFileSync(path);

	const result = convertToYaml(parse(data.toString()), path);

	console.log(result);
}

accept();
