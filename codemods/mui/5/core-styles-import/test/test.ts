import { describe, it } from 'vitest';
import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from '../src/index.js';
import { buildApi } from '@codemod-registry/utilities';

describe('mui/5/core-styles-import', function () {
	it('basic test', function () {
		const INPUT = `
        import { darken, lighten } from '@material-ui/core/styles/colorManipulator';
		import { Overrides } from '@material-ui/core/styles/overrides';
		import makeStyles from '@material-ui/core/styles/makeStyles';
		import { createTheme } from '@material-ui/core/styles';
        `;

		const OUTPUT = `
        import { createTheme, darken, lighten, Overrides, makeStyles } from '@material-ui/core/styles';
        `;

		const fileInfo: FileInfo = {
			path: 'index.ts',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
