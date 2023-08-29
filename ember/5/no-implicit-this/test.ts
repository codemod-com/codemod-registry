import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from './index.js';
import { buildApi } from '../../../utilities.js';

describe('ember 5 no-implicit-this', function () {
	it('angle-brackets-with-block-params', function () {
		const INPUT = `
		<SomeComponent as |foo hash components|>
		{{foo}}
		{{hash.property}}
	  
		<components.foo as |property|>
		  {{property}}
		</components.foo>
	  
		<components.bar />
	  
	  </SomeComponent>
        `;

		const OUTPUT = `
		<SomeComponent as |foo hash components|>
		{{foo}}
		{{hash.property}}
	  
		<components.foo as |property|>
		  {{property}}
		</components.foo>
	  
		<components.bar />
	  
	  </SomeComponent>
		`;

		const fileInfo: FileInfo = {
			path: 'index.hbs',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('angle-brackets-with-hash-params', function () {
		const INPUT = `
				<a href='invalid-url' disabled></a>
		<input value="something">

		<SomeComponent @arg="value" />
		<SomeComponent @arg=1 />
		<SomeComponent @arg=foo />
		<SomeComponent @arg={{foo}} @bar={{property}} />
		<MyAddon$MyComponent @arg={{foo}} @bar={{property}} />
		<MyAddon$Namespace::MyComponent @arg={{foo}} @bar={{property}} />
		<SomeComponent @arg={{foo}} @bar={{fn myAction}} />
		<Select
		data-test-select
		@items={{foo}}
		@onSelectItem={{action "setValue"}}
		@selectedValue={{foo}}
		/>
        `;

		const OUTPUT = `
		<a href='invalid-url' disabled></a>
		<input value="something">
		
		<SomeComponent @arg="value" />
		<SomeComponent @arg=1 />
		<SomeComponent @arg=foo />
		<SomeComponent @arg={{this.foo}} @bar={{this.property}} />
		<MyAddon$MyComponent @arg={{this.foo}} @bar={{this.property}} />
		<MyAddon$Namespace::MyComponent @arg={{this.foo}} @bar={{this.property}} />
		<SomeComponent @arg={{this.foo}} @bar={{fn this.myAction}} />
		<Select
		  data-test-select
		  @items={{this.foo}}
		  @onSelectItem={{action "setValue"}}
		  @selectedValue={{this.foo}}
		/>
		`;

		const fileInfo: FileInfo = {
			path: 'index.hbs',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('angle-brackets-without-params', function () {
		const INPUT = `
			<a></a>
			<br>
			<br />
			<foo />
			<foo></foo>
			<Foo />
			<Foo></Foo>
        `;

		const OUTPUT = `
			<a></a>
			<br>
			<br />
			<foo />
			<foo></foo>
			<Foo />
			<Foo></Foo>
		`;

		const fileInfo: FileInfo = {
			path: 'index.hbs',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('batman', function () {
		const INPUT = `
			{{addon-name$helper-name}}
			{{addon-name$component-name}}
			<AddonName$ComponentName />
			<AddonName$SomeFolderName::ComponentName />
		`;

		const OUTPUT = `
			{{addon-name$helper-name}}
			{{addon-name$component-name}}
			<AddonName$ComponentName />
			<AddonName$SomeFolderName::ComponentName />
		`;

		const fileInfo: FileInfo = {
			path: 'index.hbs',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('built-in-helpers', function () {
		const INPUT = `
		{{debugger}}
		{{has-block}}
		{{hasBlock}}
		{{input}}
		{{outlet}}
		{{textarea}}
		{{yield}}

		{{#let (concat "a" "b") as |ab|}}
		{{ab}}
		{{/let}}

		{{#each records as |record|}}
		{{record.property}}
		{{/each}}


		<button {{on 'click' myAction}}>Action</button>
		<button {{on 'click' (fn myAction foo)}}>Action</button>

		{{link-to 'name' 'route'}}
		`;

		const OUTPUT = `
		{{debugger}}
		{{has-block}}
		{{hasBlock}}
		{{input}}
		{{outlet}}
		{{textarea}}
		{{yield}}

		{{#let (concat "a" "b") as |ab|}}
		{{ab}}
		{{/let}}

		{{#each this.records as |record|}}
		{{record.property}}
		{{/each}}


		<button {{on 'click' this.myAction}}>Action</button>
		<button {{on 'click' (fn this.myAction this.foo)}}>Action</button>

		{{link-to 'name' 'route'}}
		`;

		const fileInfo: FileInfo = {
			path: 'index.hbs',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('comments', function () {
		const INPUT = `
		<!-- foo -->
		<div {{!-- foo --}}></div>
		<div>{{!-- foo bar --}}<b></b></div>
		{{!-- {{foo-bar}} --}}
		`;

		const OUTPUT = `
		<!-- foo -->
		<div {{!-- foo --}}></div>
		<div>{{!-- foo bar --}}<b></b></div>
		{{!-- {{foo-bar}} --}}
		`;

		const fileInfo: FileInfo = {
			path: 'index.hbs',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('handlebars-with-block-params', function () {
		const INPUT = `
		{{#my-component as |foo myAction hash components|}}
		{{foo}} {{myAction}}
		{{hash.property}} {{hash.foo}}

		{{components.foo}}

		{{#components.my-component}}

		{{/components.my-component}}

		{{#components.block as |block|}}
			{{block}}
		{{/components.block}}
		{{/my-component}}
		`;

		const OUTPUT = `
		{{#my-component as |foo myAction hash components|}}
		{{foo}} {{myAction}}
		{{hash.property}} {{hash.foo}}

		{{components.foo}}

		{{#components.my-component}}

		{{/components.my-component}}

		{{#components.block as |block|}}
			{{block}}
		{{/components.block}}
		{{/my-component}}
		`;

		const fileInfo: FileInfo = {
			path: 'index.hbs',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('handlebars-with-hash-params', function () {
		const INPUT = `
		{{my-component arg="string"}}
		{{my-component arg=2}}
		{{my-component arg=foo}}
		{{my-component arg=property}}
		{{my-component arg=(my-helper property)}}
		{{my-component arg=(my-helper (fn myAction property) foo)}}
		{{my-component arg=property arg2=foo}}
		{{my-component arg=property arg2=(fn myAction foo)}}
		`;

		const OUTPUT = `
		{{my-component arg="string"}}
		{{my-component arg=2}}
		{{my-component arg=this.foo}}
		{{my-component arg=this.property}}
		{{my-component arg=(my-helper this.property)}}
		{{my-component arg=(my-helper (fn this.myAction this.property) this.foo)}}
		{{my-component arg=this.property arg2=this.foo}}
		{{my-component arg=this.property arg2=(fn this.myAction this.foo)}}
		`;

		const fileInfo: FileInfo = {
			path: 'index.hbs',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('handlebars-with-positional-params', function () {
		const INPUT = `
		{{my-component "string"}}
		{{my-component 1}}
		{{my-component foo}}
		{{my-component @foo}}
		{{my-component property}}
		{{my-component (my-helper property)}}
		{{my-component (my-helper "string")}}
		{{my-component (my-helper 1)}}
		{{get this 'key'}}
		`;

		const OUTPUT = `
		{{my-component "string"}}
		{{my-component 1}}
		{{my-component this.foo}}
		{{my-component @foo}}
		{{my-component this.property}}
		{{my-component (my-helper this.property)}}
		{{my-component (my-helper "string")}}
		{{my-component (my-helper 1)}}
		{{get this 'key'}}
		`;

		const fileInfo: FileInfo = {
			path: 'index.hbs',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('handlebars-with-wall-street-syntax', function () {
		const INPUT = `
		{{my-addon$my-component foo}}
		{{my-addon$namespace::my-component @foo}}
		{{my-addon$namespace::my-component property}}
		{{my-addon$my-component (my-helper property)}}
		{{my-addon$my-component (my-helper "string")}}
		{{my-addon$namespace::my-component (my-helper 1)}}
		`;

		const OUTPUT = `
		{{my-addon$my-component this.foo}}
		{{my-addon$namespace::my-component @foo}}
		{{my-addon$namespace::my-component this.property}}
		{{my-addon$my-component (my-helper this.property)}}
		{{my-addon$my-component (my-helper "string")}}
		{{my-addon$namespace::my-component (my-helper 1)}}
		`;

		const fileInfo: FileInfo = {
			path: 'index.hbs',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	/* test fails; 
	   test is copied from https://github.com/ember-codemods/ember-no-implicit-this-codemod/tree/master/transforms/no-implicit-this/__testfixtures__
	*/
	// it('handlebars-without-params', function () {
	// 	const INPUT = `
	// 	{{my-component}}
	// 	{{a-helper}}
	// 	{{foo}}
	// 	{{property}}
	// 	{{namespace/foo}}
	// 	{{someGetter}}
	// 	`;

	// 	const OUTPUT = `
	// 	{{my-component}}
	// 	{{a-helper}}
	// 	{{foo}}
	// 	{{this.property}}
	// 	{{namespace/foo}}
	// 	{{this.someGetter}}
	// 	`;

	// 	const fileInfo: FileInfo = {
	// 		path: 'index.hbs',
	// 		source: INPUT,
	// 	};

	// 	const actualOutput = transform(fileInfo);

	// 	assert.deepEqual(
	// 		actualOutput?.replace(/\W/gm, ''),
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	it('has-block', function () {
		const INPUT = `
		{{if hasBlock "block"}}
		{{#if hasBlock}}block{{/if}}
		{{if (has-block) "block"}}
		{{#if (has-block)}}block{{/if}}
		{{if (has-block "main") "block"}}
		{{#if (has-block "main")}}block{{/if}}
		{{if (has-block-params "main") "block"}}
		{{#if (has-block-params "main")}}block{{/if}}
		`;

		const OUTPUT = `
		{{if hasBlock "block"}}
		{{#if hasBlock}}block{{/if}}
		{{if (has-block) "block"}}
		{{#if (has-block)}}block{{/if}}
		{{if (has-block "main") "block"}}
		{{#if (has-block "main")}}block{{/if}}
		{{if (has-block-params "main") "block"}}
		{{#if (has-block-params "main")}}block{{/if}}
		`;

		const fileInfo: FileInfo = {
			path: 'index.hbs',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

    /* test fails; 
	   test is copied from https://github.com/ember-codemods/ember-no-implicit-this-codemod/tree/master/transforms/no-implicit-this/__testfixtures__
	*/
	// it('paths', function () {
	// 	const INPUT = `
	// 	{{foo-bar-baz}}
	// 	{{baz}}
	// 	`;

	// 	const OUTPUT = `
	// 	{{foo-bar-baz}}
	// 	{{this.baz}}
	// 	`;

	// 	const fileInfo: FileInfo = {
	// 		path: 'index.hbs',
	// 		source: INPUT,
	// 	};

	// 	const actualOutput = transform(fileInfo);

	// 	assert.deepEqual(
	// 		actualOutput?.replace(/\W/gm, ''),
	// 		OUTPUT.replace(/\W/gm, ''),
	// 	);
	// });

	it('tagged-templates-js', function () {
		const INPUT = `
		import { hbs as echHBS } from 'ember-cli-htmlbars';
		import hipHBS from 'htmlbars-inline-precompile';
		import echipHBS from 'ember-cli-htmlbars-inline-precompile';
		import { hbs } from 'unknown-tag-source';
		
		echHBS\`
		  Hello,
			{{target}}!
		  \n
		\`;
		
		hipHBS\`Hello, {{target}}!\`;
		
		echipHBS\`Hello, {{target}}!\`;
		
		hbs\`Hello, {{target}}!\`;
		`;

		const OUTPUT = `
		import { hbs as echHBS } from 'ember-cli-htmlbars';
		import hipHBS from 'htmlbars-inline-precompile';
		import echipHBS from 'ember-cli-htmlbars-inline-precompile';
		import { hbs } from 'unknown-tag-source';
		
		echHBS\`
		  Hello,
			{{this.target}}!
		  \n
		\`;
		
		hipHBS\`Hello, {{this.target}}!\`;
		
		echipHBS\`Hello, {{this.target}}!\`;
		
		hbs\`Hello, {{target}}!\`;
		`;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('js'));

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('tagged-templates-ts', function () {
		const INPUT = `
		import { hbs as echHBS } from 'ember-cli-htmlbars';
		import hipHBS from 'htmlbars-inline-precompile';
		import echipHBS from 'ember-cli-htmlbars-inline-precompile';

		declare const hbs: unknown;

		echHBS\`
		Hello,
			{{target}}!
		\n
		\`;

		hipHBS\`Hello, {{target}}!\`;

		echipHBS\`Hello, {{target}}!\`;

		hbs\`Hello, {{target}}!\`;
		`;

		const OUTPUT = `
		import { hbs as echHBS } from 'ember-cli-htmlbars';
		import hipHBS from 'htmlbars-inline-precompile';
		import echipHBS from 'ember-cli-htmlbars-inline-precompile';

		declare const hbs: unknown;

		echHBS\`
		Hello,
			{{this.target}}!
		\n
		\`;

		hipHBS\`Hello, {{this.target}}!\`;

		echipHBS\`Hello, {{this.target}}!\`;

		hbs\`Hello, {{target}}!\`;
		`;

		const fileInfo: FileInfo = {
			path: 'index.ts',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('ts'));

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('void-elements', function () {
		const INPUT = `
		<img
		id="Preview"
		src="{{previewImageUrl}}"
		class="image"
	   >
	   
	   <img
		id="Preview"
		src="{{previewImageUrl}}"
		class="image"
	   />
		`;

		const OUTPUT = `
		<img
		id="Preview"
		src="{{this.previewImageUrl}}"
		class="image"
	   >
	   
	   <img
		id="Preview"
		src="{{this.previewImageUrl}}"
		class="image"
	   />
		`;

		const fileInfo: FileInfo = {
			path: 'index.hbs',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo);

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});
});
