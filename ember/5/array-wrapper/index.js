/**
 * This code is based on a public codemod, which is subject to the original license terms.
 * Original codemod: https://github.com/ember-codemods/ember-3x-codemods/blob/master/transforms/array-wrapper/index.js
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

	root.find(j.NewExpression, {
		callee: {
			name: 'A',
		},
	}).replaceWith(() => {
		root.find(j.ImportSpecifier, {
			imported: { name: 'A' },
			local: { name: 'A' },
		}).replaceWith(() => {
			return j.importSpecifier(j.identifier('A'), j.identifier('emberA'));
		});

		return j.callExpression(j.identifier('A'), []);
	});

	return root.toSource();
}
