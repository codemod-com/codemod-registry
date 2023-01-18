import jscodeshift, { API } from 'jscodeshift';
import type { RootHookObject, Context } from 'mocha';

const buildApi = (parser: string): API => ({
	j: jscodeshift.withParser(parser),
	jscodeshift: jscodeshift.withParser(parser),
	stats: () => {
		console.error(
			'The stats function was called, which is not supported on purpose',
		);
	},
	report: () => {
		console.error(
			'The report function was called, which is not supported on purpose',
		);
	},
});

export const mochaHooks = (): RootHookObject => {
	return {
		async beforeAll(this: Context) {
			Object.assign(this, { buildApi });
		},
	};
};
