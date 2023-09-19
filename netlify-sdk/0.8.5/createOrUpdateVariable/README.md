This codemod changes createOrUpdateVariable to pass an object instead of the separate arguments:

createOrUpdateVariable(accountId, siteId, key, value)

to 

createOrUpdateVariable({
  accountId: accountId,
  siteId: siteId,
  key: key,
  values: value
})

