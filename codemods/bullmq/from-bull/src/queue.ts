import { getBullImportDeclaration } from './get-import-declaration.js';
import type { ModifyFunction } from './types.js';

export const replaceQueueOpts: ModifyFunction = (root, j) => {
	const bullImportDeclaration = getBullImportDeclaration(root, j);

	if (!bullImportDeclaration) {
		return;
	}

	const queueExpression = root.find(j.NewExpression, {
		callee: {
			type: 'Identifier',
			name: 'Queue',
		},
	});

	if (!queueExpression.length) {
		return;
	}

	queueExpression
		.find(j.Identifier, (id) => id.name === 'createClient')
		.forEach((id) => {
			console.log(id.value.name);
			console.log(id.parentPath);
			if (typeof (id.parentPath as any).replace === 'function') {
				(id.parentPath as any).replace(
					'connection: { host: , port:  }',
				);
			}
		});
};
