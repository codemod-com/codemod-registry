import { posix } from 'node:path';
import type { Repomod } from '@intuita-inc/repomod-engine-api';

type Dependencies = Readonly<{}>;

const ROOT_LAYOUT_CONTENT = `
import { Metadata } from 'next';
 
export const metadata: Metadata = {
	title: '',
	description: '',
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body>{children}</body>
	  	</html>
	);
}
`;

const ROUTE_LAYOUT_CONTENT = `
import { Metadata } from 'next';
 
export const metadata: Metadata = {
	title: '',
	description: '',
};

export default function Layout(
	{ children, params }: {
		children: React.ReactNode;
		params: {};
	}
) {
	return <>{children}</>;
}
`;

const ROOT_ERROR_CONTENT = `
'use client';
import { useEffect } from 'react';
 
export default function Error({
	error,
	reset,
}: {
	error: Error;
	reset: () => void;
}) {
	useEffect(() => {
		console.error(error);
	}, [ error ]);
 
  	return null;
}
`;

enum FilePurpose {
	// root directory
	ROOT_LAYOUT = 'ROOT_LAYOUT',
	ROOT_ERROR = 'ROOT_ERROR',
	ROOT_PAGE = 'ROOT_PAGE',
	ROOT_NOT_FOUND = 'ROOT_NOT_FOUND',
	// route directories
	ROUTE_LAYOUT = 'ROUTE_LAYOUT',
}

export const repomod: Repomod<Dependencies> = {
	includePatterns: ['**/pages/**/*.{js,jsx,ts,tsx}'],
	excludePatterns: ['**/node_modules/**', '**/pages/api/**'],
	handleFile: async (api, path, options) => {
		const parsedPath = posix.parse(path);
		const directoryNames = parsedPath.dir.split(posix.sep);
		const endsWithPages =
			directoryNames.length > 0 &&
			directoryNames.lastIndexOf('pages') === directoryNames.length - 1;

		const nameIsIndex = parsedPath.name === 'index';

		const newDirectoryNames = directoryNames.slice(0, -1).concat('app');

		if (endsWithPages && nameIsIndex) {
			const rootLayoutPath = posix.format({
				root: parsedPath.root,
				dir: newDirectoryNames.join(posix.sep),
				ext: '.tsx',
				name: 'layout',
			});

			const rootErrorPath = posix.format({
				root: parsedPath.root,
				dir: newDirectoryNames.join(posix.sep),
				ext: '.tsx',
				name: 'error',
			});

			const rootNotFoundPath = posix.format({
				root: parsedPath.root,
				dir: newDirectoryNames.join(posix.sep),
				ext: '.tsx',
				name: 'not-found',
			});

			const rootPagePath = posix.format({
				root: parsedPath.root,
				dir: newDirectoryNames.join(posix.sep),
				ext: '.tsx',
				name: 'page',
			});

			return [
				{
					kind: 'upsertFile',
					path: rootLayoutPath,
					options: {
						...options,
						filePurpose: FilePurpose.ROOT_LAYOUT,
					},
				},
				{
					kind: 'upsertFile',
					path: rootErrorPath,
					options: {
						...options,
						filePurpose: FilePurpose.ROOT_ERROR,
					},
				},
				{
					kind: 'upsertFile',
					path: rootNotFoundPath,
					options: {
						...options,
						filePurpose: FilePurpose.ROOT_NOT_FOUND,
					},
				},
				{
					kind: 'upsertFile',
					path: rootPagePath,
					options: {
						...options,
						filePurpose: FilePurpose.ROOT_PAGE,
					},
				},
			];
		}

		return [];
	},
	handleData: async (api, path, data, options) => {
		const filePurpose = options.filePurpose;

		if (filePurpose === FilePurpose.ROOT_LAYOUT) {
			return {
				kind: 'upsertData',
				path,
				data: ROOT_LAYOUT_CONTENT,
			};
		}

		if (filePurpose === FilePurpose.ROUTE_LAYOUT) {
			return {
				kind: 'upsertData',
				path,
				data: ROUTE_LAYOUT_CONTENT,
			};
		}

		if (filePurpose === FilePurpose.ROOT_ERROR) {
			return {
				kind: 'upsertData',
				path,
				data: ROOT_ERROR_CONTENT,
			};
		}

		return {
			kind: 'noop',
		};
	},
};
