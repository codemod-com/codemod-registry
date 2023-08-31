/**
 * This code is based on a public codemod, which is subject to the original license terms.
 * Original codemod: https://github.com/ember-codemods/ember-3x-codemods/blob/master/transforms/object-new-constructor/index.js
 *
 * License: 
 	MIT License

	Copyright (c) 2019 ember-codemods

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
 * License URL: https://github.com/ember-codemods/ember-no-implicit-this-codemod/blob/master/LICENSE
 */

export default function transformer(file, api) {
	const j = api.jscodeshift;
	const root = j(file.source);

	root.find(j.NewExpression, {
		callee: {
			name: 'EmberObject',
		},
	})
		//.forEach(p => console.log(p))
		.replaceWith((path) => {
			return j.callExpression(
				j.memberExpression(
					j.identifier('EmberObject'),
					j.identifier('create'),
					false,
				),
				path.value.arguments,
			);
		});

	return root.toSource();
}
