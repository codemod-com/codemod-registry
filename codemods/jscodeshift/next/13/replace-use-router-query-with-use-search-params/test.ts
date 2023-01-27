// the best case (with no substitutions)
const oldSource = `import { useRouter } from 'next/router'; // find this first (could be aliased, probably is not)

function Component() {
	const { query } = useRouter(); //check the usage of this function

	const { a } = query;
}`;

const newSource = `
import { useSearchParams } from 'next/navigation';

function Component() {
	const query = useSearchParams();

	const a = query.get('a');
}
`;
