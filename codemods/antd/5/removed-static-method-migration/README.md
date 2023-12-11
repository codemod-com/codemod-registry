# Removed Static Method Migration

## Description
Replace message.warn with message.warning.
Replace notification.close with notification.destroy.

## Example

### Before

```ts
import { message, notification } from 'antd';

const App = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const onClick1 = () => {
   message.warn();

  }
  const onClick2 = () => {
   messageApi.warn();
  };

  const [notificationApi] = notification.useNotification();
  const onClick3 = () => {
   notification.close();
  }
  const onClick4 = () => {
   notificationApi.close();
  };

  return <>{contextHolder}</>;
};

```

### After

```ts
import { message, notification } from 'antd';

const App = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const onClick1 = () => {
   message.warning();
  }
  const onClick2 = () => {
   messageApi.warning();
  };

  const [notificationApi] = notification.useNotification();
  const onClick3 = () => {
   notification.destroy();
  }
  const onClick4 = () => {
   notificationApi.destroy();
  };

  return <>{contextHolder}</>;
};
```

## Applicability Criteria

Ant Design >= 5.0.0

## Other Metadata

### Codemod Version

v1.0.0

### Change Mode

**Assistive**: The automation partially completes changes. Human involvement is needed to make changes ready to be pushed and merged.

### **Codemod Engine**

[jscodeshift](https://github.com/facebook/jscodeshift)

### Estimated Time Saving

Up to 1 minutes per occurrence

### Owner

[Intuita](https://github.com/intuita-inc)

### Links for more info

-   https://github.com/ant-design/codemod-v5/tree/main?tab=readme-ov-file#v5-removed-component-migration
