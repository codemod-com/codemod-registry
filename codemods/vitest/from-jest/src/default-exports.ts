import type {
	ArrowFunctionExpression,
	FunctionExpression,
	Identifier,
	MemberExpression,
	ObjectProperty,
} from 'jscodeshift';
import { dirname, join, resolve } from 'path';
import { ModifyFunctionWithPath } from './types.js';

export const updateDefaultExportMocks: ModifyFunctionWithPath = (
	root,
	j,
	filePath,
) => {
	root.find(j.CallExpression, {
		callee: {
			type: 'MemberExpression',
			object: { type: 'Identifier', name: 'jest' },
			property: { type: 'Identifier' },
		},
	})
		.filter((path) =>
			['mock', 'setMock'].includes(
				((path.value.callee as MemberExpression).property as Identifier)
					.name,
			),
		)
		.forEach((path) => {
			const { arguments: args } = path.value;

			if (args.length < 2) {
				return;
			}

			const [moduleName, mock] = args;

			if (
				mock.type !== 'ArrowFunctionExpression' &&
				mock.type !== 'FunctionExpression'
			) {
				return;
			}

			if (
				moduleName.type !== 'Literal' &&
				moduleName.type !== 'StringLiteral'
			) {
				return;
			}

			const modulePath = resolve(
				join(dirname(filePath), moduleName.value as string),
			);

			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const module = require(modulePath);

			if (typeof module === 'object') return;

			if (mock.type === 'ArrowFunctionExpression') {
				const mockBody = mock.body;
				if (
					mockBody.type === 'ObjectExpression' &&
					mockBody.properties
						.map(
							(p) =>
								((p as ObjectProperty).key as Identifier).name,
						)
						.includes('default')
				)
					return;

				if (mockBody.type !== 'BlockStatement') {
					mock.body = j.objectExpression([
						j.property('init', j.identifier('default'), mockBody),
					]);
					return;
				}
			}

			const mockBody = (
				mock as FunctionExpression | ArrowFunctionExpression
			).body;
			if (mockBody.type === 'BlockStatement') {
				const returnStatement = mockBody.body[mockBody.body.length - 1];
				if (returnStatement.type === 'ReturnStatement') {
					const returnArgument = returnStatement.argument;
					if (returnArgument) {
						if (
							returnArgument.type === 'ObjectExpression' &&
							returnArgument.properties
								.map(
									(p) =>
										(
											(p as ObjectProperty)
												.key as Identifier
										).name,
								)
								.includes('default')
						) {
							return;
						}
						returnStatement.argument = j.objectExpression([
							j.property(
								'init',
								j.identifier('default'),
								returnArgument,
							),
						]);
					}
				}
			}
		});
};
