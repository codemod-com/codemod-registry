import { ESLint } from 'eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import eslintPlugin from '@typescript-eslint/eslint-plugin';

describe.only('T', () => {
	it('x', async () => {
		const eslint = new ESLint({
			plugins: {
				'react-hooks': reactHooks,
				// @ts-expect-error ecmascript literal error
				'@typescript-eslint': eslintPlugin,
			},
			fix: () => true,
			// fixTypes: ['suggestion'],
			baseConfig: {
				parser: '@typescript-eslint/parser',
				plugins: ['react-hooks'],
				rules: {
					'react-hooks/exhaustive-deps': 'warn',
				},
			},
			// baseConfig: {

			// },
			useEslintrc: false,
		});

		const x = `
            import { useEffect, useState, useRef } from 'react';

            const Y = () => {
                const searchParams = useSearchParams();

                useEffect(() => {
                    searchParams?.get('a')
                }, []);
            }
        `;

		const lintResult = await eslint.lintText(x);

		const fix = lintResult[0]?.messages[0]?.suggestions?.[0]?.fix;

		if (fix) {
			console.log(
				x.slice(0, fix.range[0]) + fix.text + x.slice(fix.range[1]),
			);
		}
	});
});
