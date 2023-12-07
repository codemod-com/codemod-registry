import type { Identifier } from 'jscodeshift';
import type { ModifyFunction } from './types.js';

const jestGlobalApis = [
	'afterAll',
	'afterEach',
	'beforeAll',
	'beforeEach',
	'describe',
	'test',
	'it',
	'fit',
	'expect',
];

const testApiProps = ['concurrent', 'each', 'only', 'skip', 'todo', 'failing'];
const jestGlobalApiProps = {
	describe: ['each', 'only', 'skip'],
	fit: ['each', 'failing'],
	it: testApiProps,
	test: testApiProps,
};

const jestToVitestApiMap: Record<string, string> = {
	fit: 'it',
	jest: 'vi',
};

export const getApisFromMemberExpression: ModifyFunction = (
	root,
	j,
): string[] => {
	const apisFromMemberExpression = [];

	for (const [jestApi, jestApiProps] of Object.entries(jestGlobalApiProps)) {
		const propNamesList = root
			.find(j.MemberExpression, {
				object: { name: jestApi },
				property: { type: 'Identifier' },
			})
			.nodes()
			.map((node) => (node.property as Identifier).name);

		const propNames = [...new Set(propNamesList)];
		for (const propName of propNames) {
			if (jestApiProps.includes(propName)) {
				apisFromMemberExpression.push(
					jestToVitestApiMap[jestApi] ?? jestApi,
				);
				break;
			}
		}
	}

	const jestObjectName = 'jest';
	const jestObjectApiCalls = root
		.find(j.MemberExpression, {
			object: { name: jestObjectName },
			property: { type: 'Identifier' },
		})
		.filter(
			(path) =>
				(path.node.property as Identifier).name !== 'disableAutomock',
		);

	if (jestObjectApiCalls.length)
		apisFromMemberExpression.push(
			jestToVitestApiMap[jestObjectName] ?? jestObjectName,
		);

	return apisFromMemberExpression;
};

export const getApisFromCallExpression: ModifyFunction = (
	root,
	j,
): string[] => {
	const apisFromCallExpression = [];

	for (const jestGlobalApi of jestGlobalApis) {
		const calls = root.find(j.CallExpression, {
			callee: { name: jestGlobalApi },
		});

		if (calls.length > 0)
			apisFromCallExpression.push(
				jestGlobalApi !== 'fit' ? jestGlobalApi : 'it',
			);
	}

	return apisFromCallExpression;
};
