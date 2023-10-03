# next-i18next Copy Keys

## Description

This codemod copies specific keys from one translation namespace to the other, for all supported languages.

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
