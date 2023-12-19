import { describe, it } from 'vitest';
import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from '../src/index.js';
import { buildApi } from '@codemod-registry/utilities';

describe('mui/4 test', function () {
	it('basic test', function () {
		const INPUT = `
        import { createMuiTheme, createTheme } from '@material-ui/core/styles';

        const theme1 = createMuiTheme();
        const theme2 = createTheme();

        const theme3 = createMuiTheme({ palette: { primary: { main: '#ff5252' } } });
        const theme4 = createTheme({ palette: { primary: { main: '#ff5252' } } });
        `;

		const OUTPUT = `
        import { createMuiTheme, ThemeOptions, adaptV4Theme } from '@material-ui/core';

        export const muiTheme = createMuiTheme();
        export const muiTheme2 = createMuiTheme(adaptV4Theme({}));
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
