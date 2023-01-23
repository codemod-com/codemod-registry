module.exports = function transformer(file, api) {
	const j = api.jscodeshift;
	const ast = j(file.source);

	// Within createGraphQLHandler, look for the `depthLimitOptions` option and replace it with `armorConfig`
	// and the original value of `maxDepth`
	ast.find(j.CallExpression, {
		callee: { name: 'createGraphQLHandler' },
	}).forEach((path) => {
		const props = path.value.arguments[0].properties.filter(
			(p) => p.key.name === 'depthLimitOptions',
		);

		if (props.length > 0) {
			const [prop] = props;

			prop.key.name = 'armorConfig';

			const val = prop.value.properties[0].value.value;

			const newValue = j.objectExpression([
				j.objectProperty(
					j.identifier('maxDepth'),
					j.objectExpression([
						j.objectProperty(
							j.identifier('n'),
							j.numericLiteral(val),
							false,
							false,
						),
					]),
					false,
					false,
				),
			]);

			prop.value = newValue;
		}
	});

	return ast.toSource({
		trailingComma: true,
		quote: 'single',
		lineTerminator: '\n',
	});
};

module.exports.type = 'js';
