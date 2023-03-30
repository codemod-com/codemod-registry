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
			source
				.replace(/^@material-ui\/core\/es/, '../../../mui-material/src')
				.replace(
					/^@material-ui\/core\/modern/,
					'../../../mui-material/src',
				),
		);
}

export default function transformer(fileInfo, api, options) {
	const j = api.jscodeshift;
	const importModule = options.importModule || '@material-ui/core';
	const targetModule = options.targetModule || '@material-ui/core';
	const printOptions = options.printOptions || {
		quote: 'single',
		trailingComma: true,
	};

	const root = j(fileInfo.source);
	const importRegExp = new RegExp(`^${importModule}/([^/]+/)+([^/]+)$`);

	const resultSpecifiers = new Map();

	const addSpecifier = (source, specifier) => {
		if (!resultSpecifiers.has(source)) {
			resultSpecifiers.set(source, []);
		}
		resultSpecifiers.get(source).push(specifier);
	};

	root.find(j.ImportDeclaration).forEach((path) => {
		if (path.value.importKind && path.value.importKind !== 'value') {
			return;
		}
		const importPath = path.value.source.value.replace(
			/(index)?(\.js)?$/,
			'',
		);
		const match = importPath.match(importRegExp);
		if (!match) {
			return;
		}

		const subpath = match[1].replace(/\/$/, '');

		if (/^(internal)/.test(subpath)) {
			return;
		}
		const targetImportPath = `${targetModule}/${subpath}`;

		let loader;
		try {
			loader = require.resolve(`${importModule}/modern/${subpath}`, {
				paths: [dirname(fileInfo.path)],
			});
		} catch (error) {
			loader = require.resolve(`${importModule}/es/${subpath}`, {
				paths: [dirname(fileInfo.path)],
			});
		}

		const whitelist = getJSExports(loader);

		path.node.specifiers.forEach((specifier, index) => {
			if (!path.node.specifiers.length) {
				return;
			}

			if (specifier.importKind && specifier.importKind !== 'value') {
				return;
			}
			if (specifier.type === 'ImportNamespaceSpecifier') {
				return;
			}
			const localName = specifier.local.name;
			switch (specifier.type) {
				case 'ImportNamespaceSpecifier':
					return;
				case 'ImportDefaultSpecifier': {
					const moduleName = match[2];
					if (
						!whitelist.has(moduleName) &&
						moduleName !== 'withStyles'
					) {
						return;
					}
					addSpecifier(
						targetImportPath,
						j.importSpecifier(
							j.identifier(moduleName),
							j.identifier(localName),
						),
					);
					path.get('specifiers', index).prune();
					break;
				}
				case 'ImportSpecifier':
					if (!whitelist.has(specifier.imported.name)) {
						return;
					}
					addSpecifier(targetImportPath, specifier);
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

	addImports(
		root,
		[...resultSpecifiers.keys()].map((source) =>
			j.importDeclaration(
				resultSpecifiers.get(source),
				j.stringLiteral(source),
			),
		),
	);

	return root.toSource(printOptions);
}