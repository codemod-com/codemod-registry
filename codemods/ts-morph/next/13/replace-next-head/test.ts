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
	it('should replace Head with Metadata', function (this: Context) {
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
    export const metadata: Metadata = { "title": "My Page Title" };
    export default function Page() {
      return (
				<>
				</>
			)
    }
	      `;

		const { actual, expected } = transform(beforeText, afterText, '.tsx');

		deepStrictEqual(actual, expected);
	});
});
