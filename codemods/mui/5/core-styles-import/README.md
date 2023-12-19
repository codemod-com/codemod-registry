# Core Styles Import

## Description

Renames private import from `core/styles/*` to `core/styles`.

## Example

### Before

```ts
import { darken, lighten } from '@material-ui/core/styles/colorManipulator';
import { Overrides } from '@material-ui/core/styles/overrides';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { createTheme } from '@material-ui/core/styles';
```

### After

```ts
import { createTheme, darken, lighten, Overrides, makeStyles } from '@material-ui/core/styles';
```

## Applicability Criteria

MUI version >= 4.0.0

## Other Metadata

### Codemod Version

v1.0.0

### Change Mode

**Autonomous**: Changes can safely be pushed and merged without further human involvement.

### **Codemod Engine**

[jscodeshift](https://github.com/facebook/jscodeshift)

### Estimated Time Saving

~5 minutes per occurrence

### Owner

[MUI](https://github.com/mui)