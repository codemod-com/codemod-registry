import type { FileInfo, API, Options, Transform } from 'jscodeshift';

function transform(
	file: FileInfo,
	api: API,
	options: Options,
): string | undefined {
	const j = api.jscodeshift;
	const root = j(file.source);
  	let dirtyFlag = false;
  
  
  	root.find(j.Identifier).forEach((path) => {
      if(path.node.name === 'isIterable') {
        path.node.name = 'isCollection'
        dirtyFlag = true;
      };
    });
  
  	if (!dirtyFlag) {
		return undefined;
	}
};

transform satisfies Transform;

export default transform;
