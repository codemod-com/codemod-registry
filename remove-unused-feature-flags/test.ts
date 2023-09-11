import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from './index.js';
import { buildApi } from '../utilities.js';

describe('remove-unused-feature-flags', function () {
	it('should not change code without feature flags', function () {
		const INPUT = `
        const Component = () => {
			return <div>A</div>;
		}
		`;

		const fileInfo: FileInfo = {
			path: 'index.ts',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});

		assert.deepEqual(actualOutput, undefined);
	});

	it('should remove a feature flag check within Promise.all()', function () {
		const INPUT = `
        const [a, b] = await Promise.all([
            Promise.resolve('a'),
            isFlagEnabled('featureFlag'),
        ]);

		const x = b && c;
		`;

		const OUTPUT = `
        const a = await Promise.resolve('a');

		const x = c;
        `;

		const fileInfo: FileInfo = {
			path: 'index.ts',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('ts'), {});

		assert.deepEqual(
			actualOutput?.replace(/\s/gm, ''),
			OUTPUT.replace(/\s/gm, ''),
		);
	});

	it('should remove a feature flag check within Promise.all() (with options)', function () {
		const INPUT = `
        const [b, a] = await Promise.all([
			fnc('b'),
            Promise.resolve('a'),
        ]);

		const d = () => {
			return c() && b;
		}
		`;

		const OUTPUT = `
        const a = await Promise.resolve('a');

		const d = () => {
			return c();
		}
        `;

		const fileInfo: FileInfo = {
			path: 'index.ts',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('ts'), {
			functionName: 'fnc',
			featureFlagName: 'b',
		});

		assert.deepEqual(
			actualOutput?.replace(/\s/gm, ''),
			OUTPUT.replace(/\s/gm, ''),
		);
	});
});
