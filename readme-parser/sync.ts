#!/usr/bin/env node

import { mkdir, writeFile } from 'fs/promises';
import * as yaml from 'js-yaml';
import { simpleGit } from 'simple-git';
import { any, record, parse as valibotParse } from 'valibot';
import { convertToYaml, parse } from './parse.js';
import { dirname } from 'path';

export const sync = async () => {
	const git = simpleGit();

	await git.addRemote(
		'website',
		'https://github.com/intuita-inc/website.git',
	);
	await git.addConfig('user.email', 'intuita@intuita.io', false, 'local');
	await git.addConfig('user.name', 'Intuita Team', false, 'local');

	await git.fetch(['website', 'master']);
	await git.fetch(['origin', 'main']);

	const diff = await git.diff(['--name-only', 'origin/main']);
	const readmesChanged = diff
		.split('\n')
		.filter((path) => path.match(/^codemods\/.*README\.md$/));

	if (!readmesChanged.length) {
		console.log('No READMEs changed. Exiting.');
		process.exit(0);
	}

	let commitCount = 0;
	for (const path of readmesChanged) {
		console.log(`Syncing ${path}`);
		const generatedSlug = path.split('/').slice(1, -1).join('-');
		const websitePath = `cms/automations/${generatedSlug}.md`;

		let websiteFile: string | null;
		let oldFile: string | null;
		try {
			websiteFile = await git.catFile([
				'-p',
				`website/master:${websitePath}`,
			]);
		} catch (err) {
			websiteFile = null;
		}

		try {
			oldFile = await git.catFile(['-p', `origin/main:${path}`]);
		} catch (err) {
			oldFile = null;
		}

		// Always exists
		const newFile = await git.catFile(['-p', `HEAD:${path}`]);

		const newReadmeYamlContent = convertToYaml(parse(newFile), path);

		const commitNewReadme = async (newContent: string) => {
			await mkdir(dirname(websitePath), { recursive: true });
			await writeFile(websitePath, newContent);
			await git.add(websitePath);
			await git.commit(`Syncs ${websitePath} from codemod-registry`);
			console.log(`Created commit for ${websitePath}`);
		};

		// If !websiteFile, we just add the file
		// If websiteFile is present, but oldFile is not, this means that
		// the website somehow had that file prior to codemod being added to the registry,
		// which technically should not be possible.
		// In that case we just update the entire file with the new one anyways.
		if (!websiteFile || !oldFile) {
			await commitNewReadme(`---\n${newReadmeYamlContent}\n---`);
			return;
		}

		// Otherwise:
		// 1. Perform a diff between old file and new file, decide what do we need to filter
		// 2. Iterate over filtered fields that have changed between commits
		// 3. If the field's version from old readme is different from website, we remove it from update list
		// 4. Otherwise, proceed and add update the fields in the object, based on website version
		// 5. Commit the file

		const websiteContentSplit = websiteFile.split('---', 3);

		const websiteYamlContent = websiteContentSplit.at(1)?.trim();

		if (!websiteYamlContent) {
			throw new Error(`Could not parse website file ${websitePath}`);
		}

		// Here, we are actually doing double-convert, json->yaml->json, but it's meant to be that way.
		// Our content's source of truth is yaml from the beginning, plus it has a lot of multi-line strings,
		// which would be a pain to handle in json. We are converting to json, just to be able to operate
		// the fields just like any other JS object, to perform the comparison.
		// Not using valibot's safeParse, because we can just error if that's not an object and we don't care
		// about the fields to be of a specific type.
		const oldContent = valibotParse(
			record(any()),
			yaml.load(convertToYaml(parse(oldFile), path)),
		);
		const newContent = valibotParse(
			record(any()),
			yaml.load(newReadmeYamlContent),
		);
		const websiteContent = valibotParse(
			record(any()),
			yaml.load(websiteYamlContent),
		);

		const updatedContent = { ...websiteContent };
		let changed = false;
		for (const key of Object.keys(newContent)) {
			// Field did not change
			if (oldContent[key] === newContent[key]) {
				continue;
			}

			// Field was changed in the CMS, no update
			if (oldContent[key] !== websiteContent[key]) {
				continue;
			}

			updatedContent[key] = newContent[key];
			changed = true;
		}

		if (!changed) {
			console.log(`Nothing to update in path ${path}`);
			continue;
		}

		let updatedYaml = `---\n${yaml.dump(updatedContent)}\n---`;
		const websiteLeftoverDescription = websiteContentSplit.at(2)?.trim();
		if (websiteLeftoverDescription) {
			updatedYaml += `\n${websiteLeftoverDescription}`;
		}

		await commitNewReadme(updatedYaml);
		commitCount += 1;
	}

	if (commitCount === 0) {
		console.log('No commits were created. Skipping push...');
		process.exit(0);
	}

	console.log(`Created ${commitCount} commits to be synced to website repo.`);
	console.log('Current status:');
	console.log(await git.status());
	await git.push('website', 'HEAD:master');
	console.log('Successfully pushed to website repo.');

	process.exit(0);
};

sync();
