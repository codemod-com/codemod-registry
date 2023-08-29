import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from './index.js';

describe('ember-5 no-implicit-this', function () {
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
});
