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
	const description = Effect.runSync(descriptionEffect);

	const index = children
		.slice(2)
		.findIndex((rootContent) => getHeading(2)(rootContent));

	const y = children.slice(2, 2 + index);

	console.log(y);

	return {
		name,
		description,
	};
};
