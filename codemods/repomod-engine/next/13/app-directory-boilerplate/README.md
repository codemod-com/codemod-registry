# app-directory-boilerplate

This codemod helps with the `pages-to-app` migration by creating a boilerplate of the `app` directory, corresponding to the current files in the `pages` directory.

The boilerplate includes the following:

-   Placeholder `page.tsx` files which define a UI unique to a route.
-   Placeholder `app/layout.tsx` root layout files which replace `pages/_app.tsx` and `pages/_document.tsx` files.
-   Placeholder `error.tsx` files which replace `pages/_error.tsx` files.
-   Placeholder `not-found.tsx` files which replace `pages/404.tsx` files.

For example:
If you have the following directory:

      pages
      ├── _app.tsx
      ├── _document.tsx
      ├── _error.tsx
      └── 404.tsx

The codemod will generate the following corresponding directory:

      app
      ├── page.tsx
      ├── layout.tsx
      ├── error.tsx
      └── not-found.tsx
