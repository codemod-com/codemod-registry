/*
The MIT License (MIT)

Copyright (c) 2023 Vercel, Inc.

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
*/

/*
Changes to the original file: add any typings in places where the compiler complained, nullability checks
*/

import { writeFileSync } from 'fs';
import type {
	API,
	Collection,
	FileInfo,
	ImportDefaultSpecifier,
	JSCodeshift,
	JSXAttribute,
	Options,
} from 'jscodeshift';

function findAndReplaceProps(
	j: JSCodeshift,
	root: Collection,
	tagName: string,
) {
	const layoutToStyle: Record<string, Record<string, string> | null> = {
		intrinsic: { maxWidth: '100%', height: 'auto' },
		responsive: { width: '100%', height: 'auto' },
		fill: null,
		fixed: null,
	};
	const layoutToSizes: Record<string, string | null> = {
		intrinsic: null,
		responsive: '100vw',
		fill: '100vw',
		fixed: null,
	};
	root.find(j.JSXElement)
		.filter(
			(el) =>
				el.value.openingElement.name &&
				el.value.openingElement.name.type === 'JSXIdentifier' &&
				el.value.openingElement.name.name === tagName,
		)
		.forEach((el) => {
			let layout = 'intrinsic';
			let objectFit = null;
			let objectPosition = null;
			let styleExpProps: any[] = [];
			let sizesAttr: JSXAttribute | null = null;
			const attributes = el.node.openingElement.attributes?.filter(
				(a) => {
					if (a.type !== 'JSXAttribute') {
						return true;
					}

					if (
						a.name.name === 'layout' &&
						a.value &&
						'value' in a.value
					) {
						layout = String(a.value.value);
						return false;
					}
					if (
						a.name.name === 'objectFit' &&
						a.value &&
						'value' in a.value
					) {
						objectFit = String(a.value.value);
						return false;
					}
					if (
						a.name.name === 'objectPosition' &&
						a.value &&
						'value' in a.value
					) {
						objectPosition = String(a.value.value);
						return false;
					}
					if (a.name.name === 'lazyBoundary') {
						return false;
					}
					if (a.name.name === 'lazyRoot') {
						return false;
					}

					if (a.name.name === 'style') {
						if (
							a.value?.type === 'JSXExpressionContainer' &&
							a.value.expression.type === 'ObjectExpression'
						) {
							styleExpProps = a.value.expression.properties;
						} else if (
							a.value?.type === 'JSXExpressionContainer' &&
							a.value.expression.type === 'Identifier'
						) {
							styleExpProps = [
								j.spreadElement(
									j.identifier(a.value.expression.name),
								),
							];
						} else {
							console.warn(
								'Unknown style attribute value detected',
								a.value,
							);
						}
						return false;
					}
					if (a.name.name === 'sizes') {
						sizesAttr = a;
						return false;
					}
					if (a.name.name === 'lazyBoundary') {
						return false;
					}
					if (a.name.name === 'lazyRoot') {
						return false;
					}
					return true;
				},
			);

			if (layout === 'fill') {
				attributes?.push(j.jsxAttribute(j.jsxIdentifier('fill')));
			}

			const sizes = layoutToSizes[layout];
			if (sizes && !sizesAttr) {
				sizesAttr = j.jsxAttribute(
					j.jsxIdentifier('sizes'),
					j.literal(sizes),
				);
			}

			if (sizesAttr) {
				attributes?.push(sizesAttr);
			}

			let style = layoutToStyle[layout];
			if (style || objectFit || objectPosition) {
				if (!style) {
					style = {};
				}
				if (objectFit) {
					style.objectFit = objectFit;
				}
				if (objectPosition) {
					style.objectPosition = objectPosition;
				}
				Object.entries(style).forEach(([key, value]) => {
					styleExpProps.push(
						j.objectProperty(
							j.identifier(key),
							j.stringLiteral(value),
						),
					);
				});
				const styleAttribute = j.jsxAttribute(
					j.jsxIdentifier('style'),
					j.jsxExpressionContainer(j.objectExpression(styleExpProps)),
				);
				attributes?.push(styleAttribute);
			}

			// TODO: should we add `alt=""` attribute?
			// We should probably let the use it manually.

			j(el).replaceWith(
				j.jsxElement(
					j.jsxOpeningElement(
						el.node.openingElement.name,
						attributes,
						el.node.openingElement.selfClosing,
					),
					el.node.closingElement,
					el.node.children,
				),
			);
		});
}

function nextConfigTransformer(j: JSCodeshift, root: Collection) {
	root.find(j.ObjectExpression).forEach((objectExpressionPath) => {
		const values = ['imgix', 'cloudinary', 'akamai'];

		const imagesObjectPropertyPaths = j(objectExpressionPath).find(
			j.ObjectProperty,
			{
				key: {
					type: 'Identifier',
					name: 'images',
				},
			},
		);

		const loaderTypeStringLiteralsPaths = imagesObjectPropertyPaths
			.map((objectPropertyPath) =>
				j(objectPropertyPath)
					.find(j.ObjectProperty, {
						key: {
							type: 'Identifier',
							name: 'loader',
						},
					})
					.paths(),
			)
			.map((objectPropertyPath) =>
				j(objectPropertyPath).find(j.StringLiteral).paths(),
			)
			.filter(
				(stringLiteralPath, i) =>
					i === 0 && values.includes(stringLiteralPath.value.value),
			);

		const pathTypeStringLiteralsPaths = imagesObjectPropertyPaths
			.map((objectPropertyPath) =>
				j(objectPropertyPath)
					.find(j.ObjectProperty, {
						key: {
							type: 'Identifier',
							name: 'path',
						},
					})
					.paths(),
			)
			.map((objectPropertyPath) =>
				j(objectPropertyPath).find(j.StringLiteral).paths(),
			)
			.filter(
				(stringLiteralPath, i) =>
					i === 0 && values.includes(stringLiteralPath.value.value),
			);

		const loaderType = loaderTypeStringLiteralsPaths.nodes()[0]?.value;
		const pathPrefix = pathTypeStringLiteralsPaths.nodes()[0]?.value;

		console.log(loaderType, pathPrefix);

		// replacement
		loaderTypeStringLiteralsPaths.replaceWith(() =>
			j.stringLiteral('custom'),
		);

		// 	const [images] = objectExpressionPath.value.properties;

		// 	if (!images) {
		// 		return;
		// 	}

		// 	if (images.type !== 'ObjectProperty') {
		// 		return;
		// 	}

		// 	const { key, value } = images;

		// 	if (key.type !== 'Identifier' || key.name !== 'images') {
		// 		return;
		// 	}

		// 	if (value.type !== 'ObjectExpression') {
		// 		return;
		// 	}

		// 	let pathPrefix = '';
		// 	let loaderType = '';

		// 	const properties = value.properties.filter((p) => {
		// 		if (
		// 			p.type === 'ObjectProperty' &&
		// 			p.key.type === 'Identifier' &&
		// 			p.key.name === 'loader' &&
		// 			'value' in p.value
		// 		) {
		// 			if (
		// 				p.value.value === 'imgix' ||
		// 				p.value.value === 'cloudinary' ||
		// 				p.value.value === 'akamai'
		// 			) {
		// 				loaderType = p.value.value;
		// 				p.value.value = 'custom';
		// 			}
		// 		}
		// 		if (
		// 			p.type === 'ObjectProperty' &&
		// 			p.key.type === 'Identifier' &&
		// 			p.key.name === 'path' &&
		// 			'value' in p.value
		// 		) {
		// 			pathPrefix = String(p.value.value);
		// 			return false;
		// 		}
		// 		return true;
		// 	});

		// 	if (loaderType && pathPrefix) {
		// 		let filename = `./${loaderType}-loader.js`;
		// 		properties.push(
		// 			j.property(
		// 				'init',
		// 				j.identifier('loaderFile'),
		// 				j.literal(filename),
		// 			),
		// 		);
		// 		value.properties = properties;
		// 		const normalizeSrc = `const normalizeSrc = (src) => src[0] === '/' ? src.slice(1) : src`;
		// 		if (loaderType === 'imgix') {
		// 			writeFileSync(
		// 				filename,
		// 				`${normalizeSrc}
		// export default function imgixLoader({ src, width, quality }) {
		// 	const url = new URL('${pathPrefix}' + normalizeSrc(src))
		// 	const params = url.searchParams
		// 	params.set('auto', params.getAll('auto').join(',') || 'format')
		// 	params.set('fit', params.get('fit') || 'max')
		// 	params.set('w', params.get('w') || width.toString())
		// 	if (quality) { params.set('q', quality.toString()) }
		// 	return url.href
		// }`
		// 					.split('\n')
		// 					.map((l) => l.trim())
		// 					.join('\n'),
		// 			);
		// 		} else if (loaderType === 'cloudinary') {
		// 			writeFileSync(
		// 				filename,
		// 				`${normalizeSrc}
		// export default function cloudinaryLoader({ src, width, quality }) {
		// 	const params = ['f_auto', 'c_limit', 'w_' + width, 'q_' + (quality || 'auto')]
		// 	const paramsString = params.join(',') + '/'
		// 	return '${pathPrefix}' + paramsString + normalizeSrc(src)
		// }`
		// 					.split('\n')
		// 					.map((l) => l.trim())
		// 					.join('\n'),
		// 			);
		// 		} else if (loaderType === 'akamai') {
		// 			writeFileSync(
		// 				filename,
		// 				`${normalizeSrc}
		// export default function akamaiLoader({ src, width, quality }) {
		// 	return '${pathPrefix}' + normalizeSrc(src) + '?imwidth=' + width
		// }`
		// 					.split('\n')
		// 					.map((l) => l.trim())
		// 					.join('\n'),
		// 			);
		// 		}
		// 	}
	});

	return root;
}

export default function transformer(
	file: FileInfo,
	api: API,
	options: Options,
) {
	const j = api.jscodeshift;
	const root = j(file.source);

	const isConfig =
		file.path === 'next.config.js' ||
		file.path === 'next.config.ts' ||
		file.path === 'next.config.mjs' ||
		file.path === 'next.config.cjs';

	if (isConfig) {
		const result = nextConfigTransformer(j, root);
		return result.toSource();
	}

	// Before: import Image from "next/legacy/image"
	//  After: import Image from "next/image"
	root.find(j.ImportDeclaration, {
		source: { value: 'next/legacy/image' },
	}).forEach((imageImport) => {
		const defaultSpecifier = imageImport.node.specifiers?.find(
			(node) => node.type === 'ImportDefaultSpecifier',
		) as ImportDefaultSpecifier | undefined;
		const tagName = defaultSpecifier?.local?.name;

		if (tagName) {
			j(imageImport).replaceWith(
				j.importDeclaration(
					imageImport.node.specifiers,
					j.stringLiteral('next/image'),
				),
			);
			findAndReplaceProps(j, root, tagName);
		}
	});
	// Before: const Image = await import("next/legacy/image")
	//  After: const Image = await import("next/image")
	root.find(j.ImportExpression, {
		source: { value: 'next/legacy/image' },
	}).forEach((imageImport) => {
		j(imageImport).replaceWith(
			j.importExpression(j.stringLiteral('next/image')),
		);
	});

	// Before: const Image = require("next/legacy/image")
	//  After: const Image = require("next/image")
	root.find(j.CallExpression).forEach((requireExp) => {
		if (
			requireExp?.value?.callee?.type === 'Identifier' &&
			requireExp.value.callee.name === 'require'
		) {
			let firstArg = requireExp.value.arguments[0];
			if (
				firstArg &&
				firstArg.type === 'Literal' &&
				firstArg.value === 'next/legacy/image'
			) {
				const tagName = requireExp?.parentPath?.value?.id?.name;
				if (tagName) {
					requireExp.value.arguments[0] = j.literal('next/image');
					findAndReplaceProps(j, root, tagName);
				}
			}
		}
	});

	// TODO: do the same transforms for dynamic imports
	return root.toSource(options);
}
