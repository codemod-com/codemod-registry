This codemod changes updateEnvironmentVariable to pass an object instead of the separate arguments:

updateEnvironmentVariable(accountId, siteId, key, values)

to 

updateEnvironmentVariable({
  accountId: accountId,
  siteId: siteId,
  key: key,
  values: values
})