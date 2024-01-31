import { API, FileInfo } from 'jscodeshift';

export default function transformer(file: FileInfo, api: API) {
	const j = api.jscodeshift;
	const root = j(file.source);

	root.find(j.TSModuleDeclaration).replaceWith((path) => {
		const { node } = path;

		if (node.body && node.body.type === 'TSModuleBlock') {
			const body = node.body.body.map((declaration) => {
				if (declaration.type === 'TSModuleDeclaration') {
					return j.exportDeclaration(
						[
							j.exportSpecifier(
								j.identifier(declaration.id.name),
								j.identifier(declaration.id.name),
							),
						],
						j.literal(null),
						j.objectExpression([]),
					);
				} else {
					return declaration;
				}
			});

			return body;
		}

		return node;
	});

	root.find(j.TSImportEqualsDeclaration).replaceWith((path) => {
		const { node } = path;
		if (node.id.type === 'Identifier') {
			return j.importDeclaration(
			  [j.importNamespaceSpecifier(node.id)],
			  j.literal(
				node.moduleReference.type === 'TSExternalModuleReference'
				  ? node.moduleReference.expression.value
				  : null,
			  ),
			);
		  }
	});

	root.find(j.TSExportAssignment).remove();

	return root.toSource();
}
