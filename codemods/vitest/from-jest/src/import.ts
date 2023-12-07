import { ModifyFunctionWithDefinedDeclaration } from './types.js';

export const addImport: ModifyFunctionWithDefinedDeclaration = (
	root,
	j,
	declaration,
) => {
	const existingImports = root.find(j.ImportDeclaration);
	if (existingImports.length > 0) {
		const firstImport = existingImports.at(0);
		const firstImportNode = firstImport.nodes()[0];
		if (firstImportNode?.comments) {
			declaration.comments = firstImportNode.comments;
			firstImportNode.comments = null;
		}

		firstImport.insertBefore(declaration);
		return;
	}

	const firstNode = root.find(j.Program).get('body', 0).node;
	const { comments } = firstNode;
	if (comments?.length) {
		const comment = comments[0];

		// Only move comments that look like file-level comments. Ignore
		// line-level and JSDoc-style comments because these probably belong
		// to the first node, rather than the file.
		if (
			(comment.type === 'Block' || comment.type === 'CommentBlock') &&
			!comment.value.startsWith('*')
		) {
			declaration.comments = comments;
			firstNode.comments = null;
		}
	}

	root.get('program', 'body').unshift(declaration);
};
