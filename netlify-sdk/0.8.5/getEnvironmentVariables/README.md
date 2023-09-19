This codemod changes getEnvironmentVariables to pass an object instead of the separate arguments:

getEnvironmentVariables(accountId, siteId)

to

getEnvironmentVariables({
accountId: accountId,
siteId: siteId
})
