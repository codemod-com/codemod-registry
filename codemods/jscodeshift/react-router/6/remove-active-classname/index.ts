/*
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

/*
Changes to the original file: added TypeScript, dirty flag, nullability checks
*/

import type { FileInfo, API, Options, Transform } from 'jscodeshift';

function transform(
	file: FileInfo,
	api: API,
	options: Options,
): string | undefined {
	const j = api.jscodeshift;

	const root = j(file.source);

	let dirtyFlag = false;

	const hasAttributes = (attributeFilter) => {
		const attributeNames = Object.keys(attributeFilter);
		return function filter(path) {
			if (!j.JSXElement.check(path.value)) {
				return false;
			}
			const elementAttributes = Object.create(null);
			path.value.openingElement.attributes.forEach(function (attr) {
				if (
					!j.JSXAttribute.check(attr) ||
					!(attr.name.name in attributeFilter)
				) {
					return;
				}
				elementAttributes[attr.name.name] = attr;
			});

			return attributeNames.every(function (name) {
				if (!(name in elementAttributes)) {
					return false;
				}

				const value = elementAttributes[name].value;
				const expected = attributeFilter[name];

				// Only when value is truthy access it's properties
				const actual = !value
					? value
					: j.Literal.check(value)
					? value.value
					: value.expression;

				if (typeof expected === 'function') {
					return expected(actual);
				}

				// Literal attribute values are always strings
				return String(expected) === actual;
			});
		};
	};

	root.findJSXElements('NavLink')
		.filter(
			hasAttributes({
				className: () => true,
				activeClassName: () => true,
			}),
		)
		.forEach((path) => {
			const attrs = path.value.openingElement.attributes;

			if (!attrs) {
				return;
			}

			const [classNameAttr] = attrs.filter((a) =>
				'name' in a ? a.name.name === 'className' : false,
			);

			if (
				!classNameAttr ||
				!('value' in classNameAttr) ||
				!classNameAttr.value ||
				!('value' in classNameAttr.value) ||
				!classNameAttr.value.value
			) {
				return;
			}

			const [activeClassNameAttr] = attrs.filter((a) =>
				'name' in a ? a.name.name === 'activeClassName' : false,
			);

			if (
				!activeClassNameAttr ||
				!('value' in activeClassNameAttr) ||
				!activeClassNameAttr.value ||
				!('value' in activeClassNameAttr.value)
			) {
				return;
			}

			const idx = attrs.findIndex((a) =>
				'name' in a ? a.name.name === 'activeClassName' : false,
			);

			// remove activeclass name
			attrs.splice(idx, 1);

			const propertyNode = j.property(
				'init',
				j.literal('isActive'),
				j.identifier('isActive'),
			);

			const arrFuncBody = j.binaryExpression(
				'+',
				j.literal(classNameAttr.value.value),
				j.conditionalExpression(
					j.identifier('isActive'),
					j.literal(` ${activeClassNameAttr.value.value}`),
					j.literal(''),
				),
			);

			classNameAttr.value = j.jsxExpressionContainer(
				j.arrowFunctionExpression(
					[j.objectPattern([propertyNode])],
					arrFuncBody,
				),
			);

			dirtyFlag = true;
		});

	if (!dirtyFlag) {
		return undefined;
	}

	return root.toSource(options);
}

transform satisfies Transform;

export default transform;
