import { FileInfo } from 'jscodeshift';
import { describe, it } from 'vitest';
import assert from 'node:assert';
import transform from '../src/index.js';
import { buildApi } from '@codemod-registry/utilities';

describe('ember 5 cp-property', function () {
	it('basic', function () {
		const INPUT = `
		const Person = EmberObject.extend({
            fullName: computed(function() {
              return \`\${this.firstName} \${this.lastName}\`;
            }).property('firstName', 'lastName')
          });
		`;

		const OUTPUT = `
		const Person = EmberObject.extend({
            fullName: computed('firstName', 'lastName', function() {
              return \`\${this.firstName} \${this.lastName}\`;
            })
          });
        `;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('js'));

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
