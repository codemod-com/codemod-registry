/**
 * This code is based on a public codemod, which is subject to the original license terms.
 * Original codemod: https://github.com/ember-codemods/ember-3x-codemods/blob/master/transforms/fpe-computed/index.js
 *
 * License: MIT
 * License URL: https://opensource.org/licenses/MIT
 */

import codemodCLI from 'codemod-cli';

const {
	jscodeshift: { getParser },
} = codemodCLI;

export default function transformer(file, api) {
	const j = getParser(api);

	const root = j(file.source);

	let alreadyHasImport = false;

	const importDeclaration = root.find(j.ImportDeclaration, {
		source: {
			value: '@ember/object',
		},
	});

	const importComputed = importDeclaration.find(j.ImportSpecifier, {
		imported: { name: 'computed' },
	});

	if (importComputed.size()) alreadyHasImport = true;

	root.find(j.CallExpression, {
		callee: {
			type: 'MemberExpression',
			object: { type: 'FunctionExpression' },
			property: { name: 'property' },
		},
	}).replaceWith((path) => {
		let computedImport = j.importDeclaration(
			[j.importSpecifier(j.identifier('computed'))],
			j.literal('@ember/object'),
		);

		if (!alreadyHasImport) {
			let body = root.get().value.program.body;

			body.unshift(computedImport);
			alreadyHasImport = true;
		}

		return j.callExpression(
			j.identifier('computed'),
			path.value.arguments.concat(path.value.callee.object),
		);
	});

	return root.toSource({ quote: 'single' });
}
