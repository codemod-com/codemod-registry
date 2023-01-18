/*
TODO: check the license with Raja (what about the TS changes)

The MIT License (MIT)

Copyright (c) 2023 Rajasegar Chandran

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

import type { FileInfo, API, Options, Transform } from 'jscodeshift';

function transform(
	file: FileInfo,
	api: API,
	options: Options,
): string | undefined {
	const j = api.jscodeshift;
	const root = j(file.source);

	root.find(j.JSXElement, {
		openingElement: { name: { name: 'RedwoodProvider' } },
	}).forEach((path) => {
		const hasChild = path.value.children?.filter((c) =>
			'openingElement' in c && 'name' in c.openingElement.name
				? c.openingElement.name.name === 'AuthProvider'
				: false,
		).length;

		if (!hasChild) {
			const newComp = j.jsxElement(
				j.jsxOpeningElement(j.jsxIdentifier('AuthProvider'), [], false),
				j.jsxClosingElement(j.jsxIdentifier('AuthProvider')),
				path.value.children,
				// false
			);

			path.value.children = [
				j.jsxText('\n  '),
				newComp,
				j.jsxText('\n  '),
			];

			root.find(j.JSXElement, {
				openingElement: { name: { name: 'RedwoodApolloProvider' } },
			}).forEach((path) => {
				const useAuthAttr = j.jsxAttribute(
					j.jsxIdentifier('useAuth'),
					j.jsxExpressionContainer(j.identifier('useAuth')),
				);

				path.value.openingElement.attributes?.push(useAuthAttr);
			});

			const authImport = root.find(j.ImportDeclaration, {
				source: { value: './auth' },
			});

			const hasAuthImport = authImport.length > 0;

			if (!hasAuthImport) {
				const importDecl = j.importDeclaration(
					[
						j.importSpecifier(
							j.identifier('AuthProvider'),
							j.identifier('AuthProvider'),
						),
						j.importSpecifier(
							j.identifier('useAuth'),
							j.identifier('useAuth'),
						),
					],
					j.stringLiteral('./auth'),
				);
				let body = root.get().value.program.body;
				body.unshift(importDecl);
			}
		}
	});

	// return root.toSource({ quote: 'single', tabWidth: 2 });
    return root.toSource(options);
}

export default transform;
