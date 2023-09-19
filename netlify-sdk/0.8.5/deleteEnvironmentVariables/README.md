This codemod changes deleteEnvironmentVariables to pass an object instead of the separate arguments:

deleteEnvironmentVariables(accountId, siteId, variables)

to

deleteEnvironmentVariables({
accountId: accountId,
siteId: siteId,
variables: variables
})
