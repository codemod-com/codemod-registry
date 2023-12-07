import type { FileInfo, API } from 'jscodeshift';
import {
	getApisFromCallExpression,
	getApisFromMemberExpression,
} from './get-api-calls.js';
import { addImport } from './import.js';
import { replaceTestApiFailing, replaceTestApiFit } from './replace-api.js';
import { addFactoryFunctionToMock } from './factory-func.js';
import { updateDefaultExportMocks } from './default-exports.js';
import { replaceJestObjectWithVi } from './jest-vi.js';

export default function transform(
	file: FileInfo,
	api: API,
): string | undefined {
	if (file.path.endsWith('.snap')) {
		return file.source.replace('Array [', '[').replace('Object {', '{');
	}

	const j = api.jscodeshift;
	const root = j(file.source);

	const apisFromCallExpression = getApisFromCallExpression(root, j);
	const apisFromMemberExpression = getApisFromMemberExpression(root, j);
	const vitestApis = [
		...new Set([...apisFromCallExpression, ...apisFromMemberExpression]),
	];

	if (vitestApis.length) {
		vitestApis.sort();
		const importSpecifiers = vitestApis.map((apiName) =>
			j.importSpecifier(j.identifier(apiName)),
		);
		const importDeclaration = j.importDeclaration(
			importSpecifiers,
			j.stringLiteral('vitest'),
		);
		addImport(root, j, importDeclaration);
	}

	replaceTestApiFit(root, j);
	replaceTestApiFailing(root, j);

	addFactoryFunctionToMock(root, j);
	updateDefaultExportMocks(root, j, file.path);
	replaceJestObjectWithVi(root, j);

	root.find(j.ImportDeclaration, {
		source: { value: '@jest/globals' },
	}).remove();

	return root.toSource();
}
