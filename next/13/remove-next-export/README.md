# Remove Next Export

The `next export` command is deprecated. This codemod dangerously removes all references to the command in `*.md`, `*.sh`, `package.json`. It also adds a property `output` with the value `export` to the `module.exports` object in `next.config.js` files.

## Example

### Shell files

```sh
npm run next build
npm run next export
```

gets transformed into:

```sh
npm run next build
```

### next.config.js files

```javascript
module.exports = {
	distDir: 'out',
};
```

gets transformed into:

```javascript
module.exports = {
	distDir: 'out',
	output: 'export',
};
```
