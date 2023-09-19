This codemod changes createOrUpdateVariables to pass an object instead of the separate arguments:

createOrUpdateVariables(accountId, siteId, variables)

to

createOrUpdateVariables({
accountId: accountId,
siteId: siteId,
key: variables
})
