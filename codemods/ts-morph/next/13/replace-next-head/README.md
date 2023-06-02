# replace-next-head

Generates a static metadata object based on meta tags managed by next/head. Marks the meta tags that can be deleted.

## Example:

```
import Head from 'next/head';
export default function Page() {
  return (
    <>
      <Head>
        <title>My page title</title>
      </Head>
    </>
  );
}
```

gets transformed to

```
import { Metadata } from "next";
import Head from 'next/head';
export const metadata: Metadata = {
	title: \`My page title\`,
};
export default function Page() {
  return (
    <>
      <Head>
        {/* this tag can be removed */}
               <title>My page title</title>
      </Head>
    </>
  );
}
```
