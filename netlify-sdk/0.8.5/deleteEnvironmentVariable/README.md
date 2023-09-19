This codemod changes deleteEnvironmentVariable to pass an object instead of the separate arguments:

deleteEnvironmentVariable(accountId, siteId, key)

to

deleteEnvironmentVariable({
accountId: accountId,
siteId: siteId,
key: key
})
