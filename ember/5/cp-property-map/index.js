import codemodCLI from 'codemod-cli';

const {
	jscodeshift: { getParser },
} = codemodCLI;

export default function transformer(file, api) {
	const j = getParser(api);

	const root = j(file.source);

	root.find(j.CallExpression, {
		callee: {
			type: 'MemberExpression',
			object: { callee: { name: 'map' } },
			property: { name: 'property' },
		},
	}).replaceWith((path) => {
		let calleeArgs = path.value.callee.object.arguments;
		let first = calleeArgs.slice(0, calleeArgs.length - 1);
		let last = calleeArgs[calleeArgs.length - 1];
		let args = [].concat(
			first,
			j.arrayExpression(path.value.arguments),
			last,
		);

		return j.callExpression(j.identifier('map'), args);
	});

	return root.toSource();
}
