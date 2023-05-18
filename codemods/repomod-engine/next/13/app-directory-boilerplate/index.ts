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

const ROOT_NOT_FOUND_CONTENT = `
export default function NotFound() {
    return null;
}
`;

const ROOT_PAGE_CONTENT = `
export default function RootPage(
    {
        params,
        searchParams,
    }: {
        params: { slug: string };
        searchParams: { [key: string]: string | string[] | undefined };
    }) {
        return null;
}
`;

const ROUTE_LAYOUT_CONTENT = `
import { Metadata } from 'next';
 
export const metadata: Metadata = {
	title: '',
	description: '',
};

export default function RouteLayout(
	{ children, params }: {
		children: React.ReactNode;
		params: {};
	}
) {
	return <>{children}</>;
}
`;

const ROUTE_PAGE_CONTENT = `
import RouteClientComponent from './client-component';

export default function RoutePage() {
	{
        params,
        searchParams,
    }: {
        params: { slug: string };
        searchParams: { [key: string]: string | string[] | undefined };
    }) {
        return <RouteClientComponent />;
}
`;

const ROUTE_CLIENT_COMPONENT_CONTENT = `
'use client';

export default function RouteClientComponent({}: {}) {
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
	ROUTE_PAGE = 'ROUTE_PAGE',
	ROUTE_CLIENT_COMPONENT = 'ROUTE_CLIENT_COMPONENT',
}

const map = new Map([
	[FilePurpose.ROOT_LAYOUT, ROOT_LAYOUT_CONTENT],
	[FilePurpose.ROOT_ERROR, ROOT_ERROR_CONTENT],
	[FilePurpose.ROOT_NOT_FOUND, ROOT_NOT_FOUND_CONTENT],
	[FilePurpose.ROOT_PAGE, ROOT_PAGE_CONTENT],
	[FilePurpose.ROUTE_LAYOUT, ROUTE_LAYOUT_CONTENT],
	[FilePurpose.ROUTE_PAGE, ROUTE_PAGE_CONTENT],
	[FilePurpose.ROUTE_CLIENT_COMPONENT, ROUTE_CLIENT_COMPONENT_CONTENT],
]);

const EXTENSION = '.tsx';

export const repomod: Repomod<Dependencies> = {
	includePatterns: ['**/pages/**/*.{js,jsx,ts,tsx}'],
	excludePatterns: ['**/node_modules/**', '**/pages/api/**'],
	handleFile: async (_, path, options) => {
		const parsedPath = posix.parse(path);
		const directoryNames = parsedPath.dir.split(posix.sep);
		const endsWithPages =
			directoryNames.length > 0 &&
			directoryNames.lastIndexOf('pages') === directoryNames.length - 1;

		const nameIsIndex = parsedPath.name === 'index';

		if (endsWithPages && nameIsIndex) {
			const newDir = directoryNames
				.slice(0, -1)
				.concat('app')
				.join(posix.sep);

			const rootLayoutPath = posix.format({
				root: parsedPath.root,
				dir: newDir,
				ext: EXTENSION,
				name: 'layout',
			});

			const rootErrorPath = posix.format({
				root: parsedPath.root,
				dir: newDir,
				ext: EXTENSION,
				name: 'error',
			});

			const rootNotFoundPath = posix.format({
				root: parsedPath.root,
				dir: newDir,
				ext: EXTENSION,
				name: 'not-found',
			});

			const rootPagePath = posix.format({
				root: parsedPath.root,
				dir: newDir,
				ext: EXTENSION,
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

		if (!endsWithPages) {
			const newDir = directoryNames
				.map((name) => name.replace('pages', 'app'))
				.concat(parsedPath.name)
				.join(posix.sep);

			const routePagePath = posix.format({
				root: parsedPath.root,
				dir: newDir,
				ext: EXTENSION,
				name: 'page',
			});

			const routeLayoutPath = posix.format({
				root: parsedPath.root,
				dir: newDir,
				ext: EXTENSION,
				name: 'layout',
			});

			const routeClientComponentPath = posix.format({
				root: parsedPath.root,
				dir: newDir,
				ext: EXTENSION,
				name: 'client-component',
			});

			return [
				{
					kind: 'upsertFile',
					path: routePagePath,
					options: {
						...options,
						filePurpose: FilePurpose.ROUTE_PAGE,
					},
				},
				{
					kind: 'upsertFile',
					path: routeLayoutPath,
					options: {
						...options,
						filePurpose: FilePurpose.ROUTE_LAYOUT,
					},
				},
				{
					kind: 'upsertFile',
					path: routeClientComponentPath,
					options: {
						...options,
						filePurpose: FilePurpose.ROUTE_CLIENT_COMPONENT,
					},
				},
			];
		}

		return [];
	},
	handleData: async (_, path, __, options) => {
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

		return {
			kind: 'upsertData',
			path,
			data: content,
		};
	},
};
