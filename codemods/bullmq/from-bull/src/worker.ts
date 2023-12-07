import type { ASTPath, CallExpression } from 'jscodeshift';
import type { ModifyFunction } from './types.js';
import { getBullImportSpecifiers } from './get-import-declaration.js';

export const replaceProcessWithWorkers: ModifyFunction = (root, j) => {
	const bullImportSpecifiers = getBullImportSpecifiers(root, j);

	if (!bullImportSpecifiers) {
		return;
	}

	const shouldApplyWorkerChanges = root.find(
		j.ImportDeclaration,
		(declaration) => {
			const declarationSource =
				declaration.source.value?.toString() ?? null;
			if (!declarationSource) {
				return false;
			}

			// Dumb way to identify proper files to make changes for worker, but at least that makes the circle smaller.
			return (
				declarationSource.includes('bull') ||
				declarationSource.includes('queue')
			);
		},
	);

	if (shouldApplyWorkerChanges) {
		root.find(
			j.MemberExpression,
			(me) =>
				me.property.type === 'Identifier' &&
				me.property.name === 'process',
		).forEach((me) => {
			if (me.parentPath.value.type !== 'CallExpression') {
				return;
			}

			const path = me.parentPath as ASTPath<CallExpression>;

			const callBody = path.value.arguments.at(0) ?? null;
			if (!callBody) {
				return;
			}

			bullImportSpecifiers.push({
				type: 'ImportSpecifier',
				imported: {
					type: 'Identifier',
					name: 'Worker',
				},
			});

			const workerDeclaration = j.variableDeclaration('const', [
				j.variableDeclarator(
					j.identifier('worker'),
					j.newExpression(j.identifier('Worker'), [callBody]),
				),
			]);

			console.log(path.replace(workerDeclaration));
		});
	}
};
