import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from '.';

describe.only('react-redux-8 add-state-type', function () {
	it('should add the State type for state parameter of the mapStateToProps arrow function', function () {
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

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should add the State type for state destructized parameter of the mapStateToProps arrow function', function () {
		const INPUT = `
            const mapStateToProps = ({ a }) => ({
                a,
            });
        `;

		const OUTPUT = `
			import { State } from "state";

			const mapStateToProps = ({ a }: State) => ({
                a,
            });
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	xit('should add the State type for state destructized parameter of the mapStateToProps function', function () {
		const INPUT = `
			function mapStateToProps (a) {
				return {
					a
				}
			}
        `;

		const OUTPUT = `
			import { State } from "state";

			function mapStateToProps (a: State) {
				return {
					a
				}
			}
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
