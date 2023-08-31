import { FileInfo } from 'jscodeshift';
import assert from 'node:assert';
import transform from './index.js';
import { buildApi } from '../../../utilities.js';

describe('ember 5 tracked-properties', function () {
	it('basic', function () {
		const INPUT = `
        import Component from '@ember/component';
        import { computed, get } from '@ember/object';
        
        export default class Foo extends Component {
          bar;
          baz = 'barBaz';
        
          @computed('baz')
          get bazInfo() {
            return \`Name: \${get(this, 'baz')}\`;
          }
        }
		`;

		const OUTPUT = `
        import { tracked } from '@glimmer/tracking';
        import Component from '@ember/component';
        import { computed, get } from '@ember/object';
        
        export default class Foo extends Component {
          bar;
          @tracked baz = 'barBaz';
        
          get bazInfo() {
            return \`Name: \${get(this, 'baz')}\`;
          }
        }
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

	it('basic-with-prefix-false', function () {
		const INPUT = `
    import Component from '@ember/component';
    import { computed, get } from '@ember/object';
    
    export default class Foo extends Component {
      bar;
      baz = 'barBaz';
    
      @computed('baz')
      get bazInfo() {
        return \`Name: \${get(this, 'baz')}\`;
      }
    }
		`;

		const OUTPUT = `
    import { tracked } from '@glimmer/tracking';
    import Component from '@ember/component';
    import { computed, get } from '@ember/object';
    
    export default class Foo extends Component {
      bar;
      @tracked
      baz = 'barBaz';
    
      get bazInfo() {
        return \`Name: \${get(this, 'baz')}\`;
      }
    }
        `;

		const fileInfo: FileInfo = {
			path: 'index.js',
			source: INPUT,
		};

		const actualOutput = transform(fileInfo, buildApi('js'), {
			alwaysPrefix: false,
		});

		assert.deepEqual(
			actualOutput?.replace(/\W/gm, ''),
			OUTPUT.replace(/\W/gm, ''),
		);
	});

	it('complex', function () {
		const INPUT = `
    import Component from '@ember/component';
    import { computed, get } from '@ember/object';
    
    export default class Foo extends Component {
      firstName = 'Foo';
      lastName;
      phone;
      zipcode;
    
      @computed('firstName', 'lastName')
      get fullName() {
        return \`Name: \${get(this, 'firstName')} \${get(this, 'lastName')}\`;
      }
    
      @computed('areaCode', 'phone')
      get phoneNumber() {
        return \`(\${get(this, 'areaCode')}) \${get(this, 'phone')}\`;
      }
    }
		`;

		const OUTPUT = `
    import { tracked } from '@glimmer/tracking';
    import Component from '@ember/component';
    import { computed, get } from '@ember/object';
    
    export default class Foo extends Component {
      @tracked firstName = 'Foo';
      @tracked lastName;
      @tracked phone;
      zipcode;
    
      get fullName() {
        return \`Name: \${get(this, 'firstName')} \${get(this, 'lastName')}\`;
      }
    
      @computed('areaCode', 'phone')
      get phoneNumber() {
        return \`(\${get(this, 'areaCode')}) \${get(this, 'phone')}\`;
      }
    }
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

	it('chained-computed', function () {
		const INPUT = `
    import Component from '@ember/component';
    import { computed, get } from '@ember/object';
    
    export default class Foo extends Component {
      foo = 'bar';
      baz;
    
      @computed('foo')
      get fooBar() {
        return \`Foo: \${get(this, 'foo')}\`;
      }
    
      @computed('fooBar')
      get fooBarDetail() {
        return \`Foo bar detail: \${get(this, 'fooBar')}\`;
      }
    
      @computed('fooBarDetail', 'bang')
      get fooBarDetailWithBaz() {
        return \`(\${get(this, 'fooBarDetail')}) \${get(this, 'baz')}\`;
      }
    }
		`;

		const OUTPUT = `
    import { tracked } from '@glimmer/tracking';
    import Component from '@ember/component';
    import { computed, get } from '@ember/object';
    
    export default class Foo extends Component {
      @tracked foo = 'bar';
      baz;
    
      @computed('foo')
      get fooBar() {
        return \`Foo: \${get(this, 'foo')}\`;
      }
    
      @computed('fooBar')
      get fooBarDetail() {
        return \`Foo bar detail: \${get(this, 'fooBar')}\`;
      }
    
      @computed('fooBarDetail', 'bang')
      get fooBarDetailWithBaz() {
        return \`(\${get(this, 'fooBarDetail')}) \${get(this, 'baz')}\`;
      }
    }
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

	it('chained-complex', function () {
		const INPUT = `
    import { tracked } from '@glimmer/tracking';
    import Component from '@glimmer/component';
    import { action, computed } from '@ember/object';
    import { inject as service } from '@ember/service';
    
    export default class AddTeamComponent extends Component {
      @service team;
      @tracked teamName;
      noOfHackers;
    
      @computed('fooBar', 'noOfHackers')
      get isMaxExceeded() {
        return this.noOfHackers > 10;
      }
    
      @computed('isMaxExceeded')
      get foo() {
        return this.isMaxExceeded;
      }
    
      @action
      addTeam() {
        this.team.addTeamName(this.teamName);
      }
    }
		`;

		const OUTPUT = `
    import { tracked } from '@glimmer/tracking';
    import Component from '@glimmer/component';
    import { action, computed } from '@ember/object';
    import { inject as service } from '@ember/service';
    
    export default class AddTeamComponent extends Component {
      @service team;
      @tracked teamName;
      @tracked noOfHackers;
    
      @computed('fooBar', 'noOfHackers')
      get isMaxExceeded() {
        return this.noOfHackers > 10;
      }
    
      @computed('isMaxExceeded')
      get foo() {
        return this.isMaxExceeded;
      }
    
      @action
      addTeam() {
        this.team.addTeamName(this.teamName);
      }
    }
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

	it('non-computed-decorators', function () {
		const INPUT = `
    import Component from '@ember/component';
    import { computed, get } from '@ember/object';
    import { alias } from '@ember/object/computed';
    
    export default class Foo extends Component {
      bar;
      // baz class property
      baz = 'barBaz';
    
      @alias('model.isFoo')
      isFoo;
    
      @computed('baz', 'isFoo')
      get bazInfo() {
        return get(this, 'isFoo') ? \`Name: \${get(this, 'baz')}\` : 'Baz';
      }
    
      @(computed('bar', 'isFoo').readOnly())
      get barInfo() {
        return get(this, 'isFoo') ? \`Name: \${get(this, 'bar')}\` : 'Bar';
      }
    }
		`;

		const OUTPUT = `
    import { tracked } from '@glimmer/tracking';
    import Component from '@ember/component';
    import { computed, get } from '@ember/object';
    import { alias } from '@ember/object/computed';
    
    export default class Foo extends Component {
      @tracked bar;
      // baz class property
      @tracked baz = 'barBaz';
    
      @alias('model.isFoo')
      isFoo;
    
      @computed('baz', 'isFoo')
      get bazInfo() {
        return get(this, 'isFoo') ? \`Name: \${get(this, 'baz')}\` : 'Baz';
      }
    
      @computed('bar', 'isFoo').readOnly()
      get barInfo() {
        return get(this, 'isFoo') ? \`Name: \${get(this, 'bar')}\` : 'Bar';
      }
    }
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

	it('read-only-computed-decorators', function () {
		const INPUT = `
    import Component from '@ember/component';
    import { computed, get } from '@ember/object';
    import { alias } from '@ember/object/computed';
    
    export default class Foo extends Component {
      bar;
      // baz class property
      baz = 'barBaz';
    
      @alias('model.isFoo')
      isFoo;
    
      @computed('baz', 'bar')
      get barBazInfo() {
        return \`Bar: \${get(this, 'bar')}, Baz: \${get(this, 'baz')}\`;
      }
    
      @(computed('bar', 'isFoo').readOnly())
      get barInfo() {
        return get(this, 'isFoo') ? \`Name: \${get(this, 'bar')}\` : 'Bar';
      }
    
      // This should not remove the 'blah' decorator since its not a computed property.
      @blah('bar')
      get barData() {
        return get(this, 'bar');
      }
    }
		`;

		const OUTPUT = `
    import { tracked } from '@glimmer/tracking';
    import Component from '@ember/component';
    import { computed, get } from '@ember/object';
    import { alias } from '@ember/object/computed';
    
    export default class Foo extends Component {
      @tracked bar;
      // baz class property
      @tracked baz = 'barBaz';
    
      @alias('model.isFoo')
      isFoo;
    
      get barBazInfo() {
        return \`Bar: \${get(this, 'bar')}, Baz: \${get(this, 'baz')}\`;
      }
    
      @(computed('bar', 'isFoo').readOnly())
      get barInfo() {
        return get(this, 'isFoo') ? \`Name: \${get(this, 'bar')}\` : 'Bar';
      }
    
      // This should not remove the 'blah' decorator since its not a computed property.
      @blah('bar')
      get barData() {
        return get(this, 'bar');
      }
    }
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

	it('with-tracked', function () {
		const INPUT = `
    import Component from '@ember/component';
    import { tracked } from '@glimmer/tracking';
    import { computed, get } from '@ember/object';
    
    export default class Foo extends Component {
      @tracked bar;
      baz = 'barBaz';
    
      @computed('baz')
      get bazInfo() {
        return \`Name: \${get(this, 'baz')}\`;
      }
    }
		`;

		const OUTPUT = `
    import Component from '@ember/component';
    import { tracked } from '@glimmer/tracking';
    import { computed, get } from '@ember/object';
    
    export default class Foo extends Component {
      @tracked bar;
      @tracked baz = 'barBaz';
    
      get bazInfo() {
        return \`Name: \${get(this, 'baz')}\`;
      }
    }
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
});
