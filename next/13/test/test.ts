import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from './index.js';
import { buildApi } from '../../../utilities.js';

describe.only('next 13 remove-get-static-props', function () {
	it('should not remove anything if getStaticProps', function () {
		const INPUT = `
		import PropTypes from "prop-types"
		import React from "react"
		
		export function MyComponent(props) {
			return <span />
		}
		
		MyComponent.propTypes = {
			bar: PropTypes.string.isRequired,
			foo: PropTypes.number,
		}  `;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('tsx'), {});

		console.log(actualOutput, '?')
		assert.deepEqual(actualOutput, undefined);
	});

	
});
