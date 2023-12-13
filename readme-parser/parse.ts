import { fromMarkdown } from 'mdast-util-from-markdown';
import { Heading, RootContent } from 'mdast';
import { pipe, Effect } from 'effect';

const getFirstDepthHeading = (rootContent: RootContent): Heading | null =>
	rootContent.type === 'heading' && rootContent.depth === 1
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

	const [firstHeader] = children;

	if (!firstHeader) {
		throw new Error('Could not find first header');
	}

	const nameEffect = pipe(
		Effect.fromNullable(getFirstDepthHeading(firstHeader)),
		Effect.flatMap((heading) =>
			Effect.fromNullable(getHeaderText(heading)),
		),
	);

	const name = Effect.runSync(nameEffect);

	return {
		name,
	};
};
