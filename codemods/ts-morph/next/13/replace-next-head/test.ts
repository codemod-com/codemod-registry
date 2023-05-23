import { Context } from 'mocha';
import { handleSourceFile } from '.';
import { Project } from 'ts-morph';
import { deepStrictEqual } from 'node:assert';

const transform = (
	beforeText: string,
	afterText: string,
	extension: '.js' | '.tsx',
) => {
	const project = new Project({
		useInMemoryFileSystem: true,
		skipFileDependencyResolution: true,
		compilerOptions: {
			allowJs: true,
		},
	});

	const actualSourceFile = project.createSourceFile(
		`actual${extension}`,
		beforeText,
	);
	const actual = handleSourceFile(actualSourceFile);

	const expected = project
		.createSourceFile(`expected${extension}`, afterText)
		.print();

	return {
		actual,
		expected,
	};
};

describe('next 13 replace-next-head', function () {
	it('should replace title tag', function (this: Context) {
		const beforeText = `
    import Head from 'next/head';
    export default function Page() {
      return (
        <>
          <Head>
            <title>My page title</title>
          </Head>
        </>
      );
    }
		`;

		const afterText = `
    import { Metadata } from "next";
    export const metadata: Metadata = { "title": "My page title" };
    export default function Page() {
      return (
        <>
          <Head>
            
          </Head>
        </>
      );
    }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(actual, expected);
	});

	it('should replace meta tags', function (this: Context) {
		const beforeText = `
    import Head from 'next/head';
    export default function Page() {
      return (
        <>
          <Head>
						<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          </Head>
        </>
      );
    }
		`;

		const afterText = `
    import { Metadata } from "next";
    export const metadata: Metadata = { "viewport": "width=device-width, initial-scale=1, viewport-fit=cover" };
		export default function Page() {
      return (
        <>
          <Head>

          </Head>
        </>
      );
    }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(actual, expected);
	});

	it('should replace meta tags properly when content is passed as variable', function (this: Context) {
		const beforeText = `
    import Head from 'next/head';
    export default function Page() {
      return (
        <>
          <Head>
						<meta name="viewport" content={process.env.VARIABLE} />
          </Head>
        </>
      );
    }
		`;

		const afterText = `
    import { Metadata } from "next";
    export const metadata: Metadata = { "viewport": process.env.VARIABLE };
		export default function Page() {
      return (
        <>
          <Head>
						
          </Head>
        </>
      );
    }
	  `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');
		deepStrictEqual(actual, expected);
	});
});
