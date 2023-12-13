import { fromMarkdown } from 'mdast-util-from-markdown';
import { Heading, RootContent } from 'mdast';
import { pipe, Effect } from 'effect';

const getHeading =
	(depth: 1 | 2) =>
	(rootContent: RootContent): Heading | null =>
		rootContent.type === 'heading' && rootContent.depth === depth
			? rootContent
			: null;

const getHeaderText = (heading: Heading): string | null => {
	const [child] = heading.children;

	if (child?.type === 'text') {
		return child.value;
	}

	return null;
};

const getText = (data: string, rootContexts: RootContent[]): string =>
	rootContexts
		.map((rootContext) => {
			const start = rootContext.position?.start.offset ?? 0;
			const end = rootContext.position?.end.offset ?? 0;

			return data.substring(start, end);
		})
		.join('\n');

export const parse = async (data: string) => {
	const { children } = fromMarkdown(data);

	const nameEffect = pipe(
		Effect.fromNullable(children[0]),
		Effect.flatMap((h) => Effect.fromNullable(getHeading(1)(h))),
		Effect.flatMap((h) => Effect.fromNullable(getHeaderText(h))),
	);

	const descriptionEffect = pipe(
		Effect.fromNullable(children[1]),
		Effect.flatMap((h) => Effect.fromNullable(getHeading(2)(h))),
		Effect.flatMap((h) => Effect.fromNullable(getHeaderText(h))),
	);

	const name = Effect.runSync(nameEffect);
	const descriptionPresent =
		Effect.runSync(descriptionEffect) === 'Description';

	const index = children
		.slice(2)
		.findIndex((rootContent) => getHeading(2)(rootContent));

	const description = getText(data, children.slice(2, 2 + index));

	console.log(description);

	return {
		name,
		descriptionPresent,
		description,
	};
};
