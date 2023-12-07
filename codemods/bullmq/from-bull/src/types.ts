import type core from 'jscodeshift';
import type { Collection } from 'jscodeshift';

export type ModifyFunction = (
	root: Collection<any>,
	j: core.JSCodeshift,
) => any;
