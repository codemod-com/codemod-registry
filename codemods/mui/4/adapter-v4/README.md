# Adapter v4

## Example

### Before

```ts
import { createMuiTheme, createTheme } from '@material-ui/core/styles';

const theme1 = createMuiTheme();
const theme2 = createTheme();

const theme3 = createMuiTheme({ palette: { primary: { main: '#ff5252' } } });
const theme4 = createTheme({ palette: { primary: { main: '#ff5252' } } });
```

### After

```ts
import { createMuiTheme, ThemeOptions, adaptV4Theme } from '@material-ui/core';

export const muiTheme = createMuiTheme();
export const muiTheme2 = createMuiTheme(adaptV4Theme({}));
```

## Applicability Criteria

MUI version <= 4.0.0

## Other Metadata

### Codemod Version

v1.0.0

### Change Mode

**Assistive**: The automation partially completes changes. Human involvement is needed to make changes ready to be pushed and merged.

### **Codemod Engine**

[jscodeshift](https://github.com/facebook/jscodeshift)

### Estimated Time Saving

Up to 10 minutes per occurrence

### Owner

[MUI](https://github.com/mui/material-ui)