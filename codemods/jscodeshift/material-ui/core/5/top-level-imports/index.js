import { readFileSync } from 'fs';
import { parseSync } from '@babel/core';
import traverse from '@babel/traverse';
import { dirname } from 'path';
import addImports from 'jscodeshift-add-imports';

const memoize = (func, resolver = (a) => a) => {
	const cache = new Map();
	return (...args) => {
		const key = resolver(...args);
		if (cache.has(key)) {
			return cache.get(key);
		}
		const value = func(...args);
		cache.set(key, value);
		return value;
	};
};

const getJSExports = memoize((file) => {
	const result = new Set();

	const ast = parseSync(readFileSync(file, 'utf8'), {
		filename: file,
	});

	traverse(ast, {
		ExportSpecifier: ({ node: { exported } }) => {
			result.add(exported.name);
		},
	});

	return result;
});

// istanbul ignore next
if (process.env.NODE_ENV === 'test') {
	const resolve = require.resolve;
	// @ts-ignore
	require.resolve = (source) =>
		resolve(
			source.replace(
				/^@mui\/material\/modern/,
				'../../../mui-material/src',
			),
		);
}

export default function transformer(fileInfo, api, options) {
	const j = api.jscodeshift;
	const importModule = options.importModule || '@mui/material';
	const targetModule = options.targetModule || '@mui/material';

	const whitelist = getJSExports(
		require.resolve(`${importModule}/modern`, {
			paths: [dirname(fileInfo.path)],
		}),
	);
	const printOptions = options.printOptions || {
		quote: 'single',
		trailingComma: true,
	};

	const root = j(fileInfo.source);
	const importRegExp = new RegExp(`^${importModule}/(?:[^/]+/)*([^/]+)$`);

	const resultSpecifiers = [];

	root.find(j.ImportDeclaration).forEach((path) => {
		if (!path.node.specifiers.length) {
			return;
		}

		if (path.value.importKind && path.value.importKind !== 'value') {
			return;
		}
		const importPath = path.value.source.value;
		const match = importPath.match(importRegExp);
		if (!match) {
			return;
		}

		if (importPath.includes('internal/')) {
			return;
		}

		path.node.specifiers.forEach((specifier, index) => {
			if (specifier.importKind && specifier.importKind !== 'value') {
				return;
			}
			if (specifier.type === 'ImportNamespaceSpecifier') {
				return;
			}

			switch (specifier.type) {
				case 'ImportDefaultSpecifier': {
					const localName = specifier.local.name;
					const moduleName = match[1];
					if (!whitelist.has(moduleName)) {
						return;
					}
					resultSpecifiers.push(
						j.importSpecifier(
							j.identifier(moduleName),
							j.identifier(localName),
						),
					);
					path.get('specifiers', index).prune();
					break;
				}
				case 'ImportSpecifier':
					if (
						!whitelist.has(specifier.imported.name) == null &&
						specifier.imported.name !== 'withStyles'
					) {
						return;
					}
					resultSpecifiers.push(specifier);
					path.get('specifiers', index).prune();
					break;
				default:
					break;
			}
		});

		if (!path.node.specifiers.length) {
			path.prune();
		}
	});

	if (resultSpecifiers.length) {
		addImports(
			root,
			j.importDeclaration(
				resultSpecifiers,
				j.stringLiteral(targetModule),
			),
		);
	}

	return root.toSource(printOptions);
}
