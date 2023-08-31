# No Implicit This

## Description

## Example

### Before:

```hbs
<SomeComponent as |foo hash components|>
	{{foo}}
	{{hash.property}}

	<components.foo as |property|>
		{{property}}
	</components.foo>

	<components.bar />

</SomeComponent>
```

### After:

```hbs
<SomeComponent as |foo hash components|>
	{{foo}}
	{{hash.property}}

	<components.foo as |property|>
		{{property}}
	</components.foo>

	<components.bar />

</SomeComponent>
```

## Applicability Criteria

## Other Metadata

### Codemod Version

v1.0.0

### Change Mode

**Autonomous**: Changes can safely be pushed and merged without further human involvement.

### **Codemod Engine**

jscodeshift

### Estimated Time Saving

~5 minutes per occurrence

### Owner

[NullVoxPopuli](https://github.com/NullVoxPopuli)

### Links for more info

-   https://github.com/ember-codemods/ember-no-implicit-this-codemod/tree/master/transforms/no-implicit-this