import transform from '.';
import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';

describe.only('new-image-experimental', () => {
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

	it('should replace next.config.ts with the tsx parser', function () {
		const fileInfo: FileInfo = {
			path: 'next.config.ts',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi('tsx'), {});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('should replace next.config.ts with the recast parser', function () {
		const fileInfo: FileInfo = {
			path: 'next.config.ts',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, this.buildApi(), {});

		console.log(actualOutput);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
