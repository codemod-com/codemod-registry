import type core from 'jscodeshift';
import type { Collection, ImportDeclaration } from 'jscodeshift';

export type ModifyFunction = (
	root: Collection<any>,
	j: core.JSCodeshift,
) => any;

export type ModifyFunctionWithPath = (
	root: Collection<any>,
	j: core.JSCodeshift,
	filePath: string,
) => any;

export type ModifyFunctionWithDefinedDeclaration = (
	root: Collection<any>,
	j: core.JSCodeshift,
	declaration: ImportDeclaration,
) => any;
