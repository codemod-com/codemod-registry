function renameProps({ root, componentName, props }) {
	return root.findJSXElements(componentName).forEach((path) => {
		path.node.openingElement.attributes.forEach((node) => {
			if (
				node.type === 'JSXAttribute' &&
				Object.keys(props).includes(node.name.name)
			) {
				node.name.name = props[node.name.name];
			}
		});
	});
}

function renameClassKey({ root, componentName, classes, printOptions }) {
	const source = root
		.findJSXElements(componentName)
		.forEach((path) => {
			path.node.openingElement.attributes.forEach((node) => {
				if (
					node.type === 'JSXAttribute' &&
					node.name.name === 'classes'
				) {
					node.value?.expression?.properties?.forEach((subNode) => {
						if (Object.keys(classes).includes(subNode.key.name)) {
							subNode.key.name = classes[subNode.key.name];
						}
					});
				}
			});
		})
		.toSource(printOptions);
	return Object.entries(classes).reduce((result, [currentKey, newKey]) => {
		const regex = new RegExp(`.Mui${componentName}-${currentKey}`, 'gm');
		return result.replace(regex, `.Mui${componentName}-${newKey}`);
	}, source);
}

export default function transformer(file, api, options) {
	const j = api.jscodeshift;
	const root = j(file.source);

	const printOptions = options.printOptions;

	renameProps({
		root,
		componentName: 'Collapse',
		props: { collapsedHeight: 'collapsedSize' },
	});

	return renameClassKey({
		root,
		componentName: 'Collapse',
		classes: { container: 'root' },
		printOptions,
	});
}
