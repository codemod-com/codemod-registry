import type { Filemod } from '@intuita-inc/filemod';
import type { JSCodeshift } from 'jscodeshift';
import { posix } from 'node:path';

type Dependencies = { jscodeshift: JSCodeshift };

type State = Record<string, never>;

export const repomod: Filemod<Dependencies, State> = {
	includePatterns: ['**/pages/**/*.{js,jsx,ts,tsx}'],
	excludePatterns: ['**/node_modules/**', '**/pages/api/**'],
	handleFile: async (api, path, data, options) => {
		// const parsedPath = posix.parse(path);
		// console.log(parsedPath);

		// const commands: FileCommand[] = [
		//   {
		//     kind: 'upsertFile',
		//     path: posix.format({
		//       root: parsedPath.root,
		//       dir: newPagePath,
		//       ext: parsedPath.ext,
		//       name: 'page',
		//     }),
		//     options: {
		//       ...options,
		//       filePurpose: FilePurpose.ROUTE_PAGE,
		//       oldPath: path,
		//       oldData: removeLeadingLineBreaks(pageContent),
		//       legacyPageData: oldData,
		//     },
		//   },
		//   {
		//     kind: 'deleteFile',
		//     path: posix.format({
		//       root: parsedPath.root,
		//       dir: parsedPath.dir,
		//       ext: parsedPath.ext,
		//       name: parsedPath.name,
		//     }),
		//     options: {
		//       ...options,
		//       filePurpose: FilePurpose.ORIGINAL_PAGE,
		//       oldPath: path,
		//       oldData,
		//     },
		//   },
		// ];

		return [];
	},
	handleData: async (api, path, data, options) => {
		return {
			kind: 'noop',
		};
	},
};
