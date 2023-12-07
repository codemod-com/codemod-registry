import type { Identifier, TSTypeReference } from 'jscodeshift';
import { getBullImportSpecifiers } from './get-import-declaration.js';
import type { ModifyFunction } from './types.js';

const typeMapper: Record<string, string> = {
	JobOptions: 'DefaultJobOptions',
};

// Any references on the right side of queue are meant to be replaced with equivalents
export const replaceTypeReferences: ModifyFunction = (root, j) => {
	const bullImportSpecifiers = getBullImportSpecifiers(root, j);

	if (!bullImportSpecifiers) {
		return;
	}

	root.find(j.TSQualifiedName).forEach((path) => {
		const { left, right } = path.value;

		if ((left as Identifier).name === 'Queue') {
			const newTypeName = typeMapper[(right as Identifier).name];
			bullImportSpecifiers.push({
				type: 'ImportSpecifier',
				imported: {
					type: 'Identifier',
					name: newTypeName,
				},
			});

			const { parentPath } = path;
			if (parentPath.value.type === 'TSTypeReference') {
				(parentPath.value as TSTypeReference).typeName = {
					type: 'Identifier',
					name: newTypeName,
				};
			}
		}
	});
};
