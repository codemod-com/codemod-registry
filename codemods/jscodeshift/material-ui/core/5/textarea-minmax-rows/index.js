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

/**
 * @param {import('jscodeshift').FileInfo} file
 * @param {import('jscodeshift').API} api
 */
export default function transformer(file, api, options) {
	const j = api.jscodeshift;
	const root = j(file.source);
	const printOptions = options.printOptions;

	renameProps({
		root,
		componentName: 'TextareaAutosize',
		props: { rows: 'minRows', rowsMin: 'minRows', rowsMax: 'maxRows' },
	});

	renameProps({
		root,
		componentName: 'TextField',
		props: { rowsMin: 'minRows', rowsMax: 'maxRows' },
	});

	return root.toSource(printOptions);
}
