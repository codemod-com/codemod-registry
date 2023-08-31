class Stack {
	constructor() {
		this.items = [];
		this.count = 0;
	}

	size() {
		return this.count;
	}

	push(...items) {
		items.forEach((item) => {
			this.items.push(item);
			this.count = this.count + 1;
		});
	}

	pop() {
		if (this.count > 0) {
			this.count = this.count - 1;
		}

		return this.items.pop();
	}
}

/**
 * Returns the file source with potentially adding the import statement for "@glimmer/tracking".
 * If `@glimmer/tracking` import is not present in the file:
 *  - If there are existing imports, then add the `@glimmer/tracking` import to the top of the imports.
 *  - If there are no imports then add the `@glimmer/tracking` import at the top of the file.
 * @param {string} fileSource
 * @param {*} j
 */
function addTrackedImport(fileSource, j) {
	const root = j(fileSource);
	const imports = root.find(j.ImportDeclaration);
	const trackedImport = imports.filter((path) => {
		return path.node.source.value === '@glimmer/tracking';
	});

	if (!trackedImport.length) {
		const trackedImportStatement =
			"import { tracked } from '@glimmer/tracking';";
		if (imports.length) {
			j(imports.at(0).get()).insertBefore(trackedImportStatement); // before the imports
		} else {
			root.get().node.program.body.unshift(trackedImportStatement); // begining of file
		}
		return root.toSource();
	}
	return fileSource;
}

/**
 * Return the array of arguments that are not local to the current class.
 * @param {*} computedArgs
 * @param {*} computedPropsMap
 * @param {*} classProperties
 */
function getDependentKeys(computedArgs, computedPropsMap, classProperties) {
	return computedArgs.filter((argItem) => {
		return _doesContainNonLocalArgs(
			argItem.value,
			computedPropsMap,
			classProperties,
		);
	});
}

/**
 * Checks the chained dependency among the arguments to see if there is any
 * value that is not a local class property.
 * Returns true if there is any property that is not a local class property.
 * @param {*} argItem
 * @param {*} computedMap
 * @param {*} classProperties
 */
function _doesContainNonLocalArgs(argItem, computedMap, classProperties) {
	const stack = new Stack();
	let currItem = argItem;
	stack.push(argItem);

	while (stack.size() > 0) {
		currItem = stack.pop();
		const dependentKeys = computedMap[currItem];

		// If currItem is not a class property and
		// if it is not a computed property with dependent keys, return true.
		if (!classProperties.includes(currItem) && !dependentKeys) {
			return true;
		}
		// If currItem itself is a computed property, then it would have dependent keys.
		// Get the dependent keys and push them in the stack.
		if (dependentKeys) {
			stack.push(...dependentKeys);
		}
	}
	return false;
}

/**
 * Create and return a new tracked decorator node based on
 * the key and values provided.
 * @param {*} macroName
 * @param {*} name
 * @param {*} j
 */
function buildTrackedDecorator(name, j) {
	var node = j('class Fake { @tracked' + ' ' + name + '; \n}')
		.find(j.ClassProperty)
		.get().node;
	return node.decorators;
}

/**
 * Returns the formatted @tracked signature. After adding the @tracked decorator
 * to the source, if the class property has a value associated with it,
 * the @tracked decorator is add above the property instead of prefixing it inline.
 * This function will check if the length of characters including the @tracked addition
 * doesn't add up to more than 50 characters, then reformat it to be prefixed instead
 * of being on a separate line.
 * @param {string} trackedConvertedSource
 */
function reformatTrackedDecorators(trackedConvertedSource) {
	const matchedTracked = trackedConvertedSource.match(/@tracked\n(.*)\n/g);
	if (matchedTracked) {
		matchedTracked.forEach((matchedData) => {
			const convertedMatchedData = matchedData.replace(
				/@tracked\n\s+/,
				'@tracked ',
			);
			trackedConvertedSource = trackedConvertedSource.replace(
				matchedData,
				convertedMatchedData,
			);
		});
	}
	return trackedConvertedSource;
}

const DEFAULT_OPTIONS = {
	alwaysPrefix: 'true',
};

/**
 * Return true if the computed property is readOnly.
 * @param {*} nodeItem
 */
function _isReadOnlyComputedProperty(nodeItem) {
	return (
		_isComputedProperty(nodeItem) &&
		nodeItem.expression.callee.property &&
		nodeItem.expression.callee.property.name === 'readOnly'
	);
}

/**
 * Return true if the nodeItem is a computed property. It could either
 * be a regular or readOnly computed property.
 * @param {*} nodeItem
 */
function _isComputedProperty(nodeItem) {
	return (
		nodeItem.expression.callee &&
		(nodeItem.expression.callee.name === 'computed' ||
			(nodeItem.expression.callee.object &&
				nodeItem.expression.callee.object.callee.name === 'computed'))
	);
}

/**
 * If the nodeItem is a computed property, then return an array of argument values.
 * @param {*} nodeItem
 */
function _getArgValues(nodeItem) {
	if (_isComputedProperty(nodeItem)) {
		const nodeArguments = _isReadOnlyComputedProperty(nodeItem)
			? nodeItem.expression.callee.object.arguments
			: nodeItem.expression.arguments;

		return nodeArguments.map((item) => item.value);
	}
}

export default function transformer(file, api, options) {
	const configOptions = Object.assign({}, DEFAULT_OPTIONS, options);
	const classProps = [];
	let computedProps = [];
	let computedPropsMap = {};
	let shouldImportBeAdded = false;
	const j = api.jscodeshift;

	j(file.source)
		.find(j.ClassBody)
		.forEach((path) => {
			path.node.body.forEach((classItem) => {
				// Collect all the class properties in the file and add it to the
				// classProps array. If there is a decorator associated with a class
				// property, then only add it to the array if it is a @tracked property.
				if (
					classItem.type === 'ClassProperty' &&
					(!classItem.decorators ||
						classItem.decorators.every(
							(item) => item.expression.name === 'tracked',
						))
				) {
					classProps.push(classItem.key.name);
				}
				// Collect all the dependent keys of the computed properties present in the file
				// and add it to the computedProps array.
				if (
					classItem.type === 'ClassMethod' &&
					classItem.kind === 'get' &&
					classItem.decorators
				) {
					classItem.decorators.forEach((decoratorItem) => {
						const argValues = _getArgValues(decoratorItem);
						if (argValues) {
							computedPropsMap[classItem.key.name] = argValues;
							computedProps = computedProps.concat(argValues);
						}
					});
				}
			});
		});

	// Iterate through all the class properties in the file and determine if
	// the property needs to be prefixed with @tracked.
	// If the class property exists in the `computedProps` array, then prefix
	// with @tracked. Also, set the `shouldImportBeAdded` to true which would help
	// determine if the import statement `@glimmer/tracking` needs to be added to
	// the file.
	let trackedConvertedSource = j(file.source)
		.find(j.ClassProperty)
		.forEach((path) => {
			if (
				!path.node.decorators &&
				computedProps.includes(path.node.key.name)
			) {
				shouldImportBeAdded = true;
				const trackedDecorator = buildTrackedDecorator(
					path.node.key.name,
					j,
				);

				// @TODO: Determine if @tracked can be prefixed alongside other decorators in a property,
				// if yes, then change this code to push the trackedDecorator along with the
				// others.
				path.node.decorators = trackedDecorator;
			}
			return path;
		})
		.toSource();

	if (configOptions.alwaysPrefix === 'true') {
		trackedConvertedSource = reformatTrackedDecorators(
			trackedConvertedSource,
		);
	}

	/**
	 * Iterate on all the class items, if the class item has decorators and it is not a dependent
	 * key of some other property, then go ahead and check if the `computed` decorator can be safely removed.
	 */
	const convertedResult = j(trackedConvertedSource)
		.find(j.ClassBody)
		.forEach((path) => {
			path.node.body.forEach((classItem) => {
				const propName = classItem.key.name;
				// Check if the class item is not a dependent key of any other computed properties in the class
				// and if the item has any decorators.
				if (
					!Object.keys(computedPropsMap).some((item) =>
						computedPropsMap[item].includes(propName),
					) &&
					classItem.decorators
				) {
					classItem.decorators.forEach((decoratorItem, i) => {
						if (
							decoratorItem.expression.type ===
								'CallExpression' &&
							_isComputedProperty(decoratorItem)
						) {
							const isReadOnlyProperty =
								_isReadOnlyComputedProperty(decoratorItem);
							const computedPropArguments = isReadOnlyProperty
								? decoratorItem.expression.callee.object
										.arguments
								: decoratorItem.expression.arguments;

							const dependentKeys = getDependentKeys(
								computedPropArguments,
								computedPropsMap,
								classProps,
							);
							// If all the arguments of the decorator are class properties, then remove the decorator completely
							// from the item.
							if (!dependentKeys.length) {
								classItem.decorators.splice(i, 1);
							}
						}
					});
				}
			});
		});

	return shouldImportBeAdded
		? addTrackedImport(convertedResult.toSource(), j)
		: convertedResult.toSource();
}
