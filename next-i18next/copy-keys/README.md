# next-i18next Copy Keys

## Description

This codemod copies specific keys from one translation namespace to the other, for all supported languages.

The codemod expects the following arguments:

-   `oldNamespace` is the name of the namespace to take the keys from,
-   `newNamespace` is the name of the namespace to copy the keys to,
-   `keys` is a comma-separated list of keys.

You need to pass these arguments using the Codemod Arguments' settings or using the Intuita CLI.

## Example:

### Before:

#### .../en/common.json

```json
{
	"copyKey": "copyKeyEnglish",
	"noopKey": "noopKeyEnglish"
}
```

#### .../en/new.json

```json
{
	"existingKey": "existingKeyEnglish"
}
```

### After:

#### .../en/common.json

```json
{
	"copyKey": "copyKeyEnglish",
	"noopKey": "noopKeyEnglish"
}
```

#### .../en/new.json

```json
{
	"existingKey": "existingKeyEnglish",
	"copyKey": "copyKeyEnglish"
}
```

## Applicability Criteria

`next-i18next > 14.x`

## Other Metadata

### Codemod Version

v1.0.0

### Change Mode

**Autonomous**: Changes can safely be pushed and merged without further human involvement.

### **Codemod Engine**

Intuita File Transformation Engine

### Estimated Time Saving

~1 minute per each key within each language file

### Owner

[Intuita](https://github.com/intuita-inc)
