const { models } = require('../../models');

const upsertAndResolve = require('./upsert-and-resolve');

// accounts: [{ userId, accountName }], unique by userId + accountName; the resolved Map key is `${userId}|${accountName}`
const upsertUserAccounts = accounts => upsertAndResolve({
  model: models.userAccount,
  entries: accounts.map(({ userId, accountName }) => ({ filter: { userId, accountName } })),
  lookup: { userId: { $in: [...new Set(accounts.map(account => account.userId))] } },
  keyOf: doc => `${doc.userId}|${doc.accountName}`,
});

module.exports = upsertUserAccounts;
