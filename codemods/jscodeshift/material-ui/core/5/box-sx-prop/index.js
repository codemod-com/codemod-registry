function propsToObject({ j, root, componentName, aliasName, propName, props }) {
	function buildObject(node, value) {
		const shorthand =
			node.value.expression &&
			node.value.expression.name === node.name.name;
		const property = j.objectProperty(
			j.identifier(node.name.name),
			node.value.expression ? node.value.expression : node.value,
		);
		property.shorthand = shorthand;
		value.push(property);

		return value;
	}

	const result = aliasName
		? root.find(j.JSXElement, {
				openingElement: { name: { property: { name: componentName } } },
		  })
		: root.findJSXElements(componentName);

	return result.forEach((path) => {
		if (
			!aliasName ||
			(aliasName &&
				path.node.openingElement.name.object.name === aliasName)
		) {
			let propValue = [];
			const attributes = path.node.openingElement.attributes;
			attributes.forEach((node, index) => {
				// Only transform whitelisted props
				if (
					node.type === 'JSXAttribute' &&
					props.includes(node.name.name)
				) {
					propValue = buildObject(node, propValue);
					delete attributes[index];
				}
			});
			if (propValue.length > 0) {
				const propNameAttr = attributes.find(
					(attr) => attr?.name?.name === propName,
				);
				if (propNameAttr) {
					(propNameAttr.value.expression?.properties || []).push(
						...j.objectExpression(propValue).properties,
					);
				} else {
					attributes.push(
						j.jsxAttribute(
							j.jsxIdentifier(propName),
							j.jsxExpressionContainer(
								j.objectExpression(propValue),
							),
						),
					);
				}
			}
		}
	});
}

const props = [
	'border',
	'borderTop',
	'borderRight',
	'borderBottom',
	'borderLeft',
	'borderColor',
	'borderRadius',
	'displayPrint',
	'display',
	'overflow',
	'textOverflow',
	'visibility',
	'whiteSpace',
	'flexDirection',
	'flexWrap',
	'justifyContent',
	'alignItems',
	'alignContent',
	'order',
	'flex',
	'flexGrow',
	'flexShrink',
	'alignSelf',
	'color',
	'bgcolor',
	'position',
	'zIndex',
	'top',
	'right',
	'bottom',
	'left',
	'boxShadow',
	'width',
	'maxWidth',
	'minWidth',
	'height',
	'maxHeight',
	'minHeight',
	'boxSizing',
	'm',
	'mt',
	'mr',
	'mb',
	'ml',
	'mx',
	'my',
	'p',
	'pt',
	'pr',
	'pb',
	'pl',
	'px',
	'py',
	'margin',
	'marginTop',
	'marginRight',
	'marginBottom',
	'marginLeft',
	'marginX',
	'marginY',
	'padding',
	'paddingTop',
	'paddingRight',
	'paddingBottom',
	'paddingLeft',
	'paddingX',
	'paddingY',
	'fontFamily',
	'fontSize',
	'fontStyle',
	'fontWeight',
	'letterSpacing',
	'lineHeight',
	'textAlign',
];

/**
 * @param {import('jscodeshift').FileInfo} file
 * @param {import('jscodeshift').API} api
 */
export default function transformer(file, api, options) {
	const j = api.jscodeshift;
	const root = j(file.source);

	const printOptions = options.printOptions || {
		quote: 'single',
	};

	let aliasName;

	root.find(j.ImportDeclaration).forEach((path) => {
		if (
			path.node.source.value.match(
				/^(@mui\/material|@material-ui\/core)$/,
			)
		) {
			if (path.node.specifiers[0]?.type === 'ImportNamespaceSpecifier') {
				aliasName = path.node.specifiers[0].local.name;
			}
		}
	});

	return propsToObject({
		j,
		root,
		aliasName,
		componentName: 'Box',
		propName: 'sx',
		props,
	}).toSource(printOptions);
}
