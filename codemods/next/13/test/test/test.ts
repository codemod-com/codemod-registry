import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from '../src/index.js';
import { buildApi } from '@codemod-registry/utilities';

describe("next/13/test", function () {
   it('should transform', function () {
       const INPUT = '';
       const OUTPUT = '';

       const fileInfo: FileInfo = {
           path: 'index.js',
           source: INPUT,
       };

       const actualOutput = transform(fileInfo, buildApi('js'), {});

       assert.deepEqual(
           actualOutput?.replace(/W/gm, ''),
           OUTPUT.replace(/W/gm, ''),
       );
   });
});