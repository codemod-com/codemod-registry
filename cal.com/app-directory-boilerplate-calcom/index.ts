/* eslint-disable @typescript-eslint/no-unused-vars */
import { join, posix } from 'node:path';
import tsmorph, { SyntaxKind } from 'ts-morph';
import type { HandleData, HandleFile, Filemod } from '@intuita-inc/filemod';

// eslint-disable-next-line @typescript-eslint/ban-types
type Dependencies = Readonly<{
	tsmorph: typeof tsmorph;
}>;

const removeLeadingLineBreaks = (input: string): string => {
	return input.replace(/^\n+/, '');
};

export const LAYOUT_CONTENT = `
import { headers } from "next/headers";
import { type ReactElement } from "react";
// default layout
import { getLayout } from "@calcom/features/MainLayout";

import PageWrapper from "@components/PageWrapperAppDir";

type LayoutProps = {
	children: ReactElement;
};

export default function Layout({ children }: LayoutProps) {
	const h = headers();
	const nonce = h.get("x-nonce") ?? undefined;

	return (
		<PageWrapper
		getLayout={getLayout}
		requiresLicense={false}
		pageProps={children?.props}
		nonce={nonce}
		themeBasis={null}>
			{children}
		</PageWrapper>
	);
}
`;

const enum FilePurpose {
	ORIGINAL_PAGE = 'ORIGINAL_PAGE',
	// route directories
	ROUTE_PAGE = 'ROUTE_PAGE',
	ROUTE_LAYOUT = 'ROUTE_LAYOUT',
}

const map = new Map([
	[FilePurpose.ORIGINAL_PAGE, ''],
	[FilePurpose.ROUTE_PAGE, ''],
	[FilePurpose.ROUTE_LAYOUT, ''],
]);

type State = Record<string, never>;

type DataAPI = Parameters<HandleData<Dependencies, State>>[0];

type FileCommand = Awaited<ReturnType<HandleFile<Dependencies, State>>>[number];
type DataCommand = Awaited<ReturnType<HandleData<Dependencies, State>>>;

const addUseClientStatement = (
	oldPath: string,
	oldData: string,
): DataCommand => {
	const project = new tsmorph.Project({
		useInMemoryFileSystem: true,
		skipFileDependencyResolution: true,
		compilerOptions: {
			allowJs: true,
		},
	});

	const sourceFile = project.createSourceFile(
		oldPath?.replace(/\.mdx$/, '.tsx') ?? '',
		oldData,
	);

	const hasUseClient = sourceFile
		.getDescendantsOfKind(SyntaxKind.StringLiteral)
		.some((node) => {
			const literal = node.getFullText();
			return literal === 'use client';
		});

	if (!hasUseClient) {
		sourceFile.insertStatements(0, `'use client';`);
	}

	return {
		kind: 'upsertData',
		path: oldPath,
		data: sourceFile.getFullText(),
	};
};

const buildPageFileData = (
	api: DataAPI,
	path: string,
	options: Readonly<Record<string, string | number | boolean | undefined>>,
	filePurpose: FilePurpose.ROUTE_PAGE,
): DataCommand => {
	const { tsmorph } = api.getDependencies();

	const rewriteWithTsMorph = (input: string): string => {
		const project = new tsmorph.Project({
			useInMemoryFileSystem: true,
			skipFileDependencyResolution: true,
			compilerOptions: {
				allowJs: true,
			},
		});

		const oldPath =
			typeof options.oldPath === 'string' ? options.oldPath : null;

		const sourceFile = project.createSourceFile(
			oldPath?.replace(/\.mdx$/, '.tsx') ?? '',
			input,
		);

		sourceFile.getFunctions().forEach((fn) => {
			if (fn.isDefaultExport()) {
				fn.remove();
				return;
			}

			const id = fn.getName() ?? '';

			if (
				[
					'getStaticProps',
					'getServerSideProps',
					'getStaticPaths',
				].includes(id)
			) {
				fn.setIsExported(false);
			}
		});

		sourceFile.getVariableStatements().forEach((statement) => {
			statement.getDeclarations().forEach((declaration) => {
				const id = declaration.getName() ?? '';

				if (
					[
						'getStaticProps',
						'getServerSideProps',
						'getStaticPaths',
					].includes(id) &&
					declaration.hasExportKeyword()
				) {
					statement.setIsExported(false);
				}
			});
		});

		sourceFile
			.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
			.filter(
				(jsxOpeningElement) =>
					jsxOpeningElement.getTagNameNode().getText() === 'Head',
			)
			.map((declaration) => {
				return declaration.getFirstAncestorByKind(
					SyntaxKind.JsxElement,
				);
			})
			.forEach((jsxElement) => {
				const parenthesizedExpressionParent =
					jsxElement?.getParentIfKind(
						SyntaxKind.ParenthesizedExpression,
					) ?? null;

				if (parenthesizedExpressionParent !== null) {
					parenthesizedExpressionParent.replaceWithText('null');

					return;
				}

				jsxElement?.replaceWithText('');
			});

		if (filePurpose === FilePurpose.ROUTE_PAGE) {
			sourceFile.getImportDeclarations().forEach((declaration) => {
				const moduleSpecifier = declaration.getModuleSpecifierValue();

				if (moduleSpecifier.startsWith('./')) {
					declaration.setModuleSpecifier(`.${moduleSpecifier}`);
				} else if (moduleSpecifier.startsWith('../')) {
					declaration.setModuleSpecifier(`../${moduleSpecifier}`);
				}
			});
		}

		sourceFile.getStatementsWithComments().forEach((statement, index) => {
			if (tsmorph.Node.isVariableStatement(statement)) {
				const declarations = statement
					.getDeclarationList()
					.getDeclarations();

				const getServerSidePropsUsed = declarations.some(
					(declaration) =>
						declaration.getName() === 'getServerSideProps',
				);

				if (getServerSidePropsUsed) {
					sourceFile.insertStatements(
						index,
						'// TODO reimplement getServerSideProps with custom logic\n',
					);
				}
			}
		});

		return sourceFile.getFullText();
	};

	return {
		kind: 'upsertData',
		path,
		data: rewriteWithTsMorph(String(options.oldData ?? '')),
	};
};

const handleFile: Filemod<
	Dependencies,
	Record<string, never>
>['handleFile'] = async (api, path, options) => {
	const parsedPath = posix.parse(path);
	const directoryNames = parsedPath.dir.split(posix.sep);
	const endsWithPages =
		directoryNames.length > 0 &&
		directoryNames.lastIndexOf('pages') === directoryNames.length - 1;

	const nameIsIndex = parsedPath.name === 'index';

	if (endsWithPages && nameIsIndex) {
		return [];
	}

	if (!endsWithPages) {
		const newDirArr = directoryNames.map((name) =>
			name.replace('pages', 'app'),
		);

		if (!nameIsIndex) {
			newDirArr.push(parsedPath.name);
		}

		const newDir = newDirArr.join(posix.sep);

		const nestedPathWithoutExtension =
			(parsedPath.dir.split('/pages/')[1] ?? '') + '/' + parsedPath.name;

		const pageContent = `import Page from "@pages/${nestedPathWithoutExtension}";
		
// TODO add metadata
export default Page;`;

		const oldData = await api.readFile(path);

		const commands: FileCommand[] = [
			{
				kind: 'upsertFile',
				path: posix.format({
					root: parsedPath.root,
					dir: newDir,
					ext: parsedPath.ext === '.mdx' ? '.mdx' : '.tsx',
					name: 'page',
				}),
				options: {
					...options,
					filePurpose: FilePurpose.ROUTE_PAGE,
					oldPath: path,
					oldData: removeLeadingLineBreaks(pageContent),
				},
			},
			{
				kind: 'upsertFile',
				path: posix.format({
					root: parsedPath.root,
					dir: newDir,
					ext: parsedPath.ext === '.mdx' ? '.mdx' : '.tsx',
					name: 'layout',
				}),
				options: {
					...options,
					filePurpose: FilePurpose.ROUTE_LAYOUT,
					oldPath: path,
					data: removeLeadingLineBreaks(LAYOUT_CONTENT),
				},
			},
			{
				kind: 'upsertFile',
				path: posix.format({
					root: parsedPath.root,
					dir: parsedPath.dir,
					ext: parsedPath.ext === '.mdx' ? '.mdx' : '.tsx',
					name: parsedPath.name,
				}),
				options: {
					...options,
					filePurpose: FilePurpose.ORIGINAL_PAGE,
					oldPath: path,
					oldData,
				},
			},
		];

		return commands;
	}

	if (parsedPath.name === '_app' || parsedPath.name === '_document') {
		return [
			{
				kind: 'deleteFile',
				path,
			},
		];
	}

	return [];
};

const handleData: HandleData<Dependencies, State> = async (
	api,
	path,
	__,
	options,
) => {
	try {
		const filePurpose = (options.filePurpose ?? null) as FilePurpose | null;

		if (filePurpose === null) {
			return {
				kind: 'noop',
			};
		}

		const content = map.get(filePurpose) ?? null;

		if (content === null) {
			return {
				kind: 'noop',
			};
		}

		if (filePurpose === FilePurpose.ROUTE_PAGE && options.oldPath) {
			return buildPageFileData(api, path, options, filePurpose);
		}

		if (filePurpose === FilePurpose.ROUTE_LAYOUT && options.data) {
			const { tsmorph } = api.getDependencies();

			const project = new tsmorph.Project({
				useInMemoryFileSystem: true,
				skipFileDependencyResolution: true,
				compilerOptions: {
					allowJs: true,
				},
			});

			const sourceFile = project.createSourceFile(
				path,
				String(options.data),
			);

			return {
				kind: 'upsertData',
				path,
				data: sourceFile.getFullText(),
			};
		}

		if (
			filePurpose === FilePurpose.ORIGINAL_PAGE &&
			options.oldPath &&
			options.oldData
		) {
			return addUseClientStatement(
				String(options.oldPath),
				String(options.oldData),
			);
		}

		return {
			kind: 'upsertData',
			path,
			data: content,
		};
	} catch (error) {
		return {
			kind: 'noop',
		};
	}
};

export const repomod: Filemod<Dependencies, State> = {
	includePatterns: ['**/pages/**/*.{js,jsx,ts,tsx}'],
	excludePatterns: ['**/node_modules/**', '**/pages/api/**'],
	handleFile,
	handleData,
};
