import type { FileInfo, API, Options } from 'jscodeshift';

export default function transformer(file: FileInfo, api: API, options: Options) {
    const j = api.jscodeshift;
    const root = j(file.source);
  
    root
      .find(j.CallExpression, {
        callee: { name: 'createGraphQLHandler' },
      })
      .forEach((path) => {
        const arg = path.value.arguments[0];

        if (!arg || !('properties' in arg)) {
            return;
        }

        const hasProp = arg.properties
            .filter(
                (property) => 'key' in property && 'name' in property.key
                    ? property.key.name === 'authDecoder'
                    : false
            ).length;
  
        if (!hasProp) {

          arg.properties.unshift(
            j.objectProperty(j.identifier('authDecoder'), j.identifier('authDecoder'))
          );

          const importDecl = j.importDeclaration(
            [j.importSpecifier(j.identifier('authDecoder'), j.identifier('authDecoder'))],
            j.stringLiteral('@redwoodjs/auth-auth0-api')
          );

          const body = root.get().value.program.body;
          body.unshift(importDecl);
        }
      });
  
    return root.toSource(options);
  };