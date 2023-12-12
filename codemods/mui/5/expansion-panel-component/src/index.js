/**
 * @param {import('jscodeshift').FileInfo} file
 */
export default function transformer(file) {
	return file.source.replace(/([^a-zA-Z])ExpansionPanel/gm, '$1Accordion');
}
