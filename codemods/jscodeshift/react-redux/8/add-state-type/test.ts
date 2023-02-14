import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from '.';

describe.only('react-redux-8 add-state-type', function () {
	it('', function () {
		const INPUT = `
            const mapStateToProps = (state) => ({
                a: selectA(state),
            });
        `;

		const OUTPUT = `
			import { State } from "state";

			const mapStateToProps = (state: State) => ({
                a: selectA(state),
            });
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

		console.log(actualOutput);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
