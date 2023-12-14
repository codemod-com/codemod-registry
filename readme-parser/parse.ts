import type { Heading, PhrasingContent, RootContent } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';

const noFirstLetterLowerCase = (str: string) =>
	str[0] + str.slice(1).toLowerCase();

const capitalize = (str: string) =>
	str[0] ? str[0].toUpperCase() + str.slice(1) : str;

const getTextFromNode = (
	node: RootContent | PhrasingContent | undefined,
): string | null => {
	if (!node) {
		return null;
	}

	if ('value' in node) {
		return node.value;
	}

	if ('children' in node) {
		return getTextFromNode(node.children[0]);
	}

	return null;
};

const getUrlFromNode = (
	node: RootContent | PhrasingContent | undefined,
): string | null => {
	if (!node) {
		return null;
	}

	if ('url' in node) {
		return node.url;
	}

	if ('children' in node) {
		return getUrlFromNode(node.children[0]);
	}

	return null;
};

const getHeading = (
	rootContent: RootContent[],
	depth: 1 | 2 | 3,
	name?: string,
) => {
	const heading = rootContent.find((rc) => {
		if (rc.type !== 'heading') {
			return false;
		}

		if (name) {
			const headerTitle = getTextFromNode(rc);

			if (
				!headerTitle ||
				!noFirstLetterLowerCase(headerTitle).startsWith(
					noFirstLetterLowerCase(name),
				)
			) {
				return false;
			}
		}

		return rc.depth === depth;
	}) as Heading | undefined;

	return heading ?? null;
};

const getTextByHeader = (
	rootContent: RootContent[],
	heading: Heading,
	delimiter = '\n',
) => {
	const headerIndex = rootContent.findIndex(
		(rc) => rc.position?.start.line === heading.position?.start.line,
	);
	const nextHeaderIndex = rootContent.findIndex(
		(rc) =>
			rc.type === 'heading' &&
			rc.position?.start.line &&
			heading.position?.start.line &&
			rc.position?.start.line > heading.position?.start.line &&
			rc.depth === heading.depth,
	);

	const contentParts = rootContent.slice(
		headerIndex + 1,
		nextHeaderIndex > -1 ? nextHeaderIndex : undefined,
	);

	const textParts: string[] = [];

	for (const rc of contentParts) {
		if ('children' in rc) {
			const truncatedChildren = rc.children
				.map((child) => {
					if (child.type === 'text') {
						return `${child.value}${delimiter}`;
					}

					if (child.type === 'listItem') {
						return `${getUrlFromNode(
							child.children[0],
						)}${delimiter}`;
					}

					if (child.type === 'link' || child.type === 'strong') {
						return getTextFromNode(child.children[0]);
					}

					// Do not add new line after certain blocks (treated as separate AST nodes)
					if (child.type === 'inlineCode') {
						return child.value;
					}

					return null;
				})
				.filter(Boolean) as string[];

			textParts.push(...truncatedChildren);
		}

		if ('value' in rc) {
			if (rc.type === 'code') {
				textParts.push(
					`\`\`\`${rc.lang}\n${rc.value}\n\`\`\`${delimiter}`,
				);
			} else {
				textParts.push(`${rc.value}${delimiter}`);
			}
		}
	}

	// Trim last el to remove delimiter
	const lastElement = textParts[textParts.length - 1];
	if (lastElement) {
		const lastSymbol = lastElement[lastElement.length - 1];
		if (lastSymbol && lastSymbol.match(/\W/)) {
			textParts[textParts.length - 1] = lastElement.slice(0, -1);
		}
	}

	return textParts.join('');
};

export const parse = (data: string) => {
	const { children } = fromMarkdown(data);

	const nameHeading = getHeading(children, 1);
	const name =
		nameHeading?.children[0] && 'value' in nameHeading.children[0]
			? nameHeading.children[0].value
			: null;

	if (!name) {
		throw new Error('Name not found');
	}

	const descHeading = getHeading(children, 2, 'Description');
	const description = descHeading
		? getTextByHeader(children, descHeading)
		: null;
	if (!description) {
		throw new Error('Description not found');
	}

	const exampleHeading = getHeading(children, 2, 'Example');
	const examples = exampleHeading
		? getTextByHeader(children, exampleHeading)
		: null;
	if (!examples) {
		throw new Error('Examples not found');
	}

	const applicabilityHeader = getHeading(children, 2, 'Applicability');
	const applicability = applicabilityHeader
		? getTextByHeader(children, applicabilityHeader)
		: null;
	if (!applicability) {
		throw new Error('Applicability criteria not found');
	}
	if (!applicability.match(/[\w]+ (>|>=) \d+\.\d+\.\d+/)) {
		throw new Error('Applicability criteria is of a wrong format');
	}

	const versionHeader = getHeading(children, 3, 'Codemod Version');
	const version = versionHeader
		? getTextByHeader(children, versionHeader)
		: null;
	if (!version) {
		throw new Error('Codemod version not found');
	}
	const versionMatch = version.match(/(v)?(\d+\.\d+\.\d+)/)?.at(2);

	const changeModeHeader = getHeading(children, 3, 'Change Mode');
	const changeModeText = changeModeHeader
		? getTextByHeader(children, changeModeHeader).toLowerCase()
		: null;
	if (!changeModeText) {
		throw new Error('Change mode not found');
	}
	let changeMode: string | null = null;
	if (changeModeText.includes('assistive')) {
		changeMode = 'assistive';
	} else if (changeModeText.includes('autonomous')) {
		changeMode = 'autonomous';
	}
	if (!changeMode) {
		throw new Error('Change mode is of a wrong format');
	}

	const engineHeader = getHeading(children, 3, 'Codemod Engine');
	const engineText = engineHeader
		? getTextByHeader(children, engineHeader)
		: null;
	if (!engineText) {
		throw new Error('Codemod engine not found');
	}
	let engine: string | null = null;
	if (engineText.includes('ts-morph')) {
		engine = 'ts-morph';
	} else if (engineText.includes('jscodeshift')) {
		engine = 'jscodeshift';
	}
	if (!engine) {
		throw new Error('Codemod engine is of a wrong format');
	}

	const timeSaveHeader = getHeading(children, 3, 'Estimated Time Saving');
	const timeSave = timeSaveHeader
		? getTextByHeader(children, timeSaveHeader).replace(' per ', '/')
		: null;
	if (!timeSave) {
		throw new Error('Estimated time saving not found');
	}

	const ownerHeader = getHeading(children, 3, 'Owner');
	const owner = ownerHeader
		? getTextByHeader(children, ownerHeader) ?? 'Intuita'
		: null;

	const linksHeader = getHeading(children, 3, 'Links');
	const links = linksHeader
		? getTextByHeader(children, linksHeader, ',')
		: null;

	return {
		name,
		description,
		examples,
		applicability,
		version: versionMatch,
		changeMode,
		engine,
		timeSave,
		owner,
		links,
	};
};

export const convertToYaml = (data: ReturnType<typeof parse>) => {
	const {
		name,
		description,
		examples,
		applicability,
		changeMode,
		engine,
		timeSave,
		owner,
	} = data;

	// f_author - possible to find by .includes(<owner>) under cms/authors, like cms/authors/rajasegar-chandran.md
	// f_slug_name - can infer from config by throwing away framework version?
	// f_cli_command - intuita <infer_name_from_config>
	// f_github_link - <should_be_available_in_push_metadata>
	// create-on - <readme_file_create_time>
	const res = `
---
created-on: -
f_long-description: |-
  ## Description
  ${description}
  ${examples}
f_github-link: -
f_vs-code-link: -
f_codemod-studio-link: -
f_cli-command: -
f_framework: -
f_applicability-criteria: ${applicability}
f_verified-codemod: ${owner === 'Intuita' ? 'true' : 'false'}
f_author: -
layout: "[automations].html"
slug: -
title: ${name}
updated-on: -
published-on: -
f_slug-name: -
f_codemod-engine: cms/codemod-engines/${engine}.md
f_change-mode-2: ${capitalize(changeMode)}
f_estimated-time-saving: ${timeSave}
tags: automations
seo: -
---
`.trim();

	return res;
};
