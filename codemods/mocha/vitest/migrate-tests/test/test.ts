import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from '../src/index.js';
import { buildApi } from '@codemod-registry/utilities';

describe('mocha/vitest test', function () {
	it('when `expect` for `chai` is being imported', function () {
		const INPUT = `
        import { expect } from 'chai';

        describe('Test Suite 1', () => {
          it('addition', () => {
            expect(1 + 1).to.equal(2);
          });
        });
        
        describe('Test Suite 2', () => {
          it('subtraction', () => {
            expect(1 - 1).to.equal(0);
          });
        });
        `;

		const OUTPUT = `
        import { describe, it, expect } from 'vitest';

        describe('Test Suite 1', () => {
          it('addition', () => {
            expect(1 + 1).to.equal(2);
          });
        });
        
        describe('Test Suite 2', () => {
          it('subtraction', () => {
            expect(1 - 1).to.equal(0);
          });
        });
        `;

		const fileInfo: FileInfo = {
			path: 'index.ts',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('when `chai` is not used', function () {
		const INPUT = `
        describe('Test Suite 1', () => {
          it('addition', () => {
            assert(1 + 1 == 2);
          });
        });
        
        describe('Test Suite 2', () => {
          it('subtraction', () => {
            assert(1 - 1 == 0);
          });
        });
        `;

		const OUTPUT = `
        import { describe, it } from 'vitest';

        describe('Test Suite 1', () => {
          it('addition', () => {
            assert(1 + 1 == 2);
          });
        });
        
        describe('Test Suite 2', () => {
          it('subtraction', () => {
            assert(1 - 1 == 0);
          });
        });
        `;

		const fileInfo: FileInfo = {
			path: 'index.ts',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
