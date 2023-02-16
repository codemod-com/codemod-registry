import transform from '.';
import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';

describe.only('new-image-experimental', () => {
	it('should add the State type for state parameter of the mapStateToProps and the mapDispatchToProps function', function () {
		const INPUT = `
		const withPwa = (opts) => {
			// no-op but image this adds props
			return opts
		  }
		  module.exports = withPwa({
			images: {
			  loader: "cloudinary",
			  path: "https://example.com/",
			},
		  })
        `;

		const OUTPUT = `
		const withPwa = (opts) => {
			// no-op but image this adds props
			return opts
		  }
		  module.exports = withPwa({
			images: {
			  loader: "custom",
			  loaderFile: "./cloudinary-loader.js",
			},
		  })
        `;

		const fileInfo: FileInfo = {
			path: 'next.config.ts',
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
