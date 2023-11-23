/*! @license
This code is based on a public codemod, which is subject to the original license terms.
Original codemod: https://github.com/ember-codemods/ember-no-implicit-this-codemod/blob/master/transforms/no-implicit-this/index.js

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
License URL: https://github.com/ember-codemods/ember-no-implicit-this-codemod/blob/master/LICENSE
*/

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import recast from 'ember-template-recast';
import { getTelemetry } from 'ember-codemods-telemetry-helpers';

import debugLib from 'debug';

const debug = debugLib('ember-no-implicit-this-codemod:transform');

const DEFAULT_OPTIONS = {};

// Determines whether the given identifier is a reference to an export
// from a particular module.
function isImportReference(path, importSource, importName) {
	let scope = path.scope.lookup(path.node.name);
	let bindings = scope ? scope.getBindings() : {};
	let bindingIdentifiers = bindings[path.node.name] || [];

	for (let binding of bindingIdentifiers) {
		let specifier = binding.parent.node;
		let importDeclaration = binding.parent.parent.node;
		let bindingImportedName =
			specifier.type === 'ImportDefaultSpecifier'
				? 'default'
				: specifier.type === 'ImportSpecifier'
				? specifier.imported.name
				: null;

		if (
			bindingImportedName === importName &&
			importDeclaration.source.value === importSource
		) {
			return true;
		}
	}

	return false;
}

const TEMPLATE_TAG_IMPORTS = [
	{ source: 'ember-cli-htmlbars', name: 'hbs' },
	{ source: 'htmlbars-inline-precompile', name: 'default' },
	{ source: 'ember-cli-htmlbars-inline-precompile', name: 'default' },
];

// Identifies whether a TaggedTemplateExpression corresponds to an Ember template
// using one of a known set of `hbs` tags.
function isEmberTemplate(path) {
	let tag = path.get('tag');
	let hasInterpolation = path.node.quasi.quasis.length !== 1;
	let isKnownTag = TEMPLATE_TAG_IMPORTS.some(({ source, name }) =>
		isImportReference(tag, source, name),
	);

	return isKnownTag && !hasInterpolation;
}

const KNOWN_HELPERS = [
	// Ember.js
	'action',
	'array',
	'component',
	'concat',
	'debugger',
	'each',
	'each-in',
	'else',
	'fn',
	'get',
	'hash',
	'has-block',
	'has-block-params',
	'if',
	'if-unless',
	'in-element',
	'-in-element',
	'input',
	'textarea',
	'let',
	'link-to',
	'loc',
	'log',
	'mut',
	'on',
	'outlet',
	'partial',
	'query-params',
	'readonly',
	'unbound',
	'unless',
	'with',
	'yield',

	// Glimmer VM
	'identity', // glimmer blocks
	'render-inverse', // glimmer blocks
	'-get-dynamic-var', // glimmer internal helper
];

function populateInvokeables(telemetry) {
	let components = [];
	let helpers = [];

	for (let name of Object.keys(telemetry)) {
		let entry = telemetry[name];

		switch (entry.type) {
			case 'Component':
				components.push(name);
				break;
			case 'Helper':
				helpers.push(name);
				break;
		}
	}

	return [components, helpers];
}

/**
 * plugin entrypoint
 */
function _transform(root, options = {}) {
	let b = recast.builders;

	let scopedParams = [];
	let telemetry = options.telemetry || {};
	let [components, helpers] = populateInvokeables(telemetry);

	let customHelpers = options.customHelpers || [];

	let paramTracker = {
		enter(node) {
			node.blockParams.forEach((param) => {
				scopedParams.push(param);
			});
		},

		exit(node) {
			node.blockParams.forEach(() => {
				scopedParams.pop();
			});
		},
	};

	function handleParams(params) {
		for (let param of params) {
			if (param.type !== 'PathExpression') continue;
			handlePathExpression(param);
		}
	}

	function handleHash(hash) {
		for (let pair of hash.pairs) {
			if (pair.value.type !== 'PathExpression') continue;
			handlePathExpression(pair.value);
		}
	}

	function handlePathExpression(node) {
		// skip this.foo
		if (node.this) {
			debug(
				`Skipping \`%s\` because it is already prefixed with \`this.\``,
				node.original,
			);
			return;
		}

		// skip @foo
		if (node.data) {
			debug(
				`Skipping \`%s\` because it is already prefixed with \`@\``,
				node.original,
			);
			return;
		}

		// skip {#foo as |bar|}}{{bar}}{{/foo}}
		// skip <Foo as |bar|>{{bar}}</Foo>
		let firstPart = node.parts[0];
		if (scopedParams.includes(firstPart)) {
			debug(
				`Skipping \`%s\` because it is a scoped variable`,
				node.original,
			);
			return;
		}

		// skip `hasBlock` keyword
		if (node.original === 'hasBlock') {
			debug(`Skipping \`%s\` because it is a keyword`, node.original);
			return;
		}

		// add `this.` prefix
		debug(
			`Transforming \`%s\` to \`this.%s\``,
			node.original,
			node.original,
		);
		Object.assign(node, b.path(`this.${node.original}`));
	}

	function isHelper(name) {
		if (KNOWN_HELPERS.includes(name)) {
			debug(`Skipping \`%s\` because it is a known helper`, name);
			return true;
		}

		if (customHelpers.includes(name)) {
			debug(
				`Skipping \`%s\` because it is a custom configured helper`,
				name,
			);
			return true;
		}

		let helper = helpers.find((path) => path.endsWith(`/${name}`));
		if (helper) {
			let message = `Skipping \`%s\` because it appears to be a helper from the telemetry data: %s`;
			debug(message, name, helper);
			return true;
		}

		return false;
	}

	function isComponent(name) {
		let component = components.find((path) => path.endsWith(`/${name}`));
		if (component) {
			let message = `Skipping \`%s\` because it appears to be a component from the telemetry data: %s`;
			debug(message, name, component);
			return true;
		}

		return false;
	}

	let inAttrNode = false;

	recast.traverse(root, {
		Block: paramTracker,
		ElementNode: paramTracker,

		AttrNode: {
			enter() {
				inAttrNode = true;
			},
			exit() {
				inAttrNode = false;
			},
		},

		MustacheStatement(node) {
			let { path, params, hash } = node;

			// {{foo BAR}}
			handleParams(params);

			// {{foo bar=BAZ}}
			handleHash(hash);

			let hasParams = params.length !== 0;
			let hasHashPairs = hash.pairs.length !== 0;

			// {{FOO}}
			if (path.type === 'PathExpression' && !hasParams && !hasHashPairs) {
				// {{FOO.bar}}
				if (path.parts.length > 1) {
					handlePathExpression(path);
					return;
				}

				// skip ember-holy-futuristic-template-namespacing-batman component/helper invocations
				// (see https://github.com/rwjblue/ember-holy-futuristic-template-namespacing-batman)
				if (
					path.original.includes('$') ||
					path.original.includes('::')
				) {
					let message = `Skipping \`%s\` because it looks like a helper/component invocation from ember-holy-futuristic-template-namespacing-batman`;
					debug(message, path.original);
					return;
				}

				// skip helpers
				if (isHelper(path.original)) return;

				// skip components
				if (!inAttrNode && isComponent(path.original)) return;

				handlePathExpression(path);
			}
		},

		BlockStatement(node) {
			// {{#foo BAR}}{{/foo}}
			handleParams(node.params);

			// {{#foo bar=BAZ}}{{/foo}}
			handleHash(node.hash);
		},

		SubExpression(node) {
			// (foo BAR)
			handleParams(node.params);

			// (foo bar=BAZ)
			handleHash(node.hash);
		},

		ElementModifierStatement(node) {
			// <div {{foo BAR}} />
			handleParams(node.params);

			// <div {{foo bar=BAZ}} />
			handleHash(node.hash);
		},
	});
}

/**
 * Accepts the config path for custom helpers and returns the array of helpers
 * if the file path is resolved.
 * Context: This will allow the users to specify their custom list of helpers
 * along with the known helpers, this would give them more flexibility for handling
 * special usecases.
 * @param {string} configPath
 */
function _getCustomHelpersFromConfig(configPath) {
	// eslint-disable-next-line no-undef
	const cwd = fileURLToPath(new URL('.', import.meta.url));

	let customHelpers = [];
	if (configPath) {
		let filePath = path.join(cwd, configPath);
		let config = JSON.parse(fs.readFileSync(filePath));
		if (config.helpers) {
			customHelpers = config.helpers;
		}
	}
	return customHelpers;
}

/**
 * Returns custom options object to support the custom helpers config path passed
 * by the user.
 */
function getOptions() {
	let options = {
		customHelpers: _getCustomHelpersFromConfig(),
		telemetry: getTelemetry(),
	};
	return options;
}

/**
 * Given the location and source text of a template, as well as codemod options,
 * returns the rewritten template contents with `this` references inserted where
 * necessary.
 */
function rewriteTemplate(path, source, options) {
	debug('Parsing %s ...', path);
	let root = recast.parse(source);

	debug('Transforming %s ...', path);
	_transform(root, options);

	debug('Generating new content for %s ...', path);
	return recast.print(root);
}

/**
 * Given a JS or TS file that potentially has embedded templates within it,
 * returns updated source with those templates rewritten to include `this`
 * references where needed.
 */
function rewriteEmbeddedTemplates(file, options, api) {
	const j = api.jscodeshift;
	const root = j(file.source);
	return root
		.find('TaggedTemplateExpression', { tag: { type: 'Identifier' } })
		.forEach((path) => {
			if (isEmberTemplate(path)) {
				let { value } = path.node.quasi.quasis[0];
				value.raw = rewriteTemplate(file.path, value.raw, options);
			}
		})
		.toSource();
}

export default function transform(file, api, moreOptions) {
	let extension = path.extname(file.path).toLowerCase();
	let options = Object.assign({}, DEFAULT_OPTIONS, getOptions(), moreOptions);
	if (extension === '.hbs') {
		return rewriteTemplate(file.path, file.source, options);
	} else if (extension === '.js' || extension === '.ts') {
		return rewriteEmbeddedTemplates(file, options, api);
	} else {
		debug(
			'Skipping %s because it does not match a known extension with templates',
			file.path,
		);
	}
}
