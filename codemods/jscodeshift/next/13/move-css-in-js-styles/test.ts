import type { FileInfo } from 'jscodeshift';
import transform from '.';
import assert from 'node:assert/strict';
import { Context } from 'mocha';
import sinon from 'sinon';

const INPUT = `
export default () => (
    <div>
      <p>only this paragraph will get the style :)</p>
          <SomeComponent />
      
        <style jsx>{\`
         p {
          color: red;
         }
        \`}</style>
    </div>
)`;

const OUTPUT = `
import styles from "./index.module.css";

export default () => (
  <div className={styles.wrapper}>
    <p>only this paragraph will get the style :)</p>
        <SomeComponent />
  </div>
)
`;

const STYLE_FILE =
	'\n         p {\n          color: red;\n         }\n        ';

describe.only('next 13 move-css-in-js-styles', function () {
	it('should remove the style component, add an import and a class name', async function (this: Context) {
		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const options = {
			createFile(path: string, data: string) {},
		};

		const spy = sinon.spy(options);

		const actualOutput = transform(fileInfo, this.buildApi('js'), options);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);

		assert.equal(spy.createFile.calledOnce, true);

		console.log(spy.createFile.getCalls());

		assert.deepEqual(spy.createFile.calledOnceWith('a', STYLE_FILE), true);
	});
});
