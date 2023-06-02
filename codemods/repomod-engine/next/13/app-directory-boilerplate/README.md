# app-directory-boilerplate

The first step to migrate your pages to the `app` directory is to provide a structure of files.

This is attempted by this codemod, which reads the content of your `pages` directory and creates the placeholder files.

The boilerplate includes the following:

-   placeholder `page.tsx` files which define a UI unique to a route.
-   the placeholder `app/layout.tsx` file which replaces `pages/_app.tsx` and `pages/_document.tsx` files.
-   the placeholder `error.tsx` file which replaces `pages/_error.tsx` files.
-   the placeholder `not-found.tsx` file which replaces `pages/404.tsx` files.

## Example

If you have the following directory:

      pages
      ├── _app.tsx
      ├── _document.tsx
      ├── _error.tsx
      ├── 404.tsx
      ├── a.tsx
      └── b
            └── c.tsx

The codemod will generate the following corresponding directory:

      app
      ├── page.tsx
      ├── layout.tsx
      ├── error.tsx
      ├── not-found.tsx
      ├── a
            ├── page.tsx
            ├── layout.tsx
      └── b
            └── c
                  ├── page.tsx
                  └── layout.tsx
