import assert from 'node:assert';
import { FileInfo } from 'jscodeshift';
import { describe, it } from 'vitest';
import transform from '../src/index';
import { buildApi } from '@codemod-registry/utilities';

describe('typescript migrate-modules', function () {
	it('1', function () {
		const INPUT = `
            module Module1 {
              export interface Person {
                name: string;
                age: number;
              }
            
              export function greet(person: Person): string {
                return 'Hello';
              }
            }
            
            export = Module1;
        `;

		const OUTPUT = `
            export interface Person {
              name: string;
              age: number;
            }
          
            export function greet(person: Person): string {
              return 'Hello';
            }
        `;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('2', function () {
		const INPUT = `
            module Module1 {
              import Module2 = require('./Module2');
            
              export interface Person {
                name: string;
                age: number;
              }
            
              export function greet(person: Person): string {
                return 'Hello';
              }
            
              export function waveHands(): void {
                Module2.wave();
              }
            }
            
            export = Module1;
        `;

		const OUTPUT = `
            import * as Module2 from './Module2';

            export interface Person {
              name: string;
              age: number;
            }
            
            export function greet(person: Person): string {
              return 'Hello';
            }
            
            export function waveHands(): void {
              Module2.wave();
            }
        `;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('aliases', function () {
		const INPUT = `
            module Module1 {
              import Module2 = require('./Module2');
            
              export interface Person {
                name: string;
                age: number;
              }
            
              export function greet(person: Person): string {
                return 'Hello';
              }
            
              export { Module2 as AliasModule };
            }
            
            export = Module1;
        `;

		const OUTPUT = `
            import * as Module2 from './Module2';

            export interface Person {
              name: string;
              age: number;
            }
            
            export function greet(person: Person): string {
              return 'Hello';
            }
            
            export { Module2 as AliasModule };
        `;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('nested', function () {
		const INPUT = `
            module Module1 {
              module NestedModule {
                export const constantValue = 42;
              }
            
              export { NestedModule };
            }
            
            export = Module1;
        `;

		const OUTPUT = `
            export module NestedModule {
              export const constantValue = 42;
            }
        `;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('Exporting and Importing Types', function () {
		const INPUT = `
            module MyModule {            
              import SomeType = require('./SomeType');
              export { SomeType };
            }
            
            export = MyModule;
        `;

		const OUTPUT = `
            import * as SomeType from './SomeType';
            export { SomeType };
        `;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'));

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
