const logger = require('../../utils/logger');

const upsertAgents = require('./upsert-agents');
const upsertPolicyCarriers = require('./upsert-policy-carriers');
const upsertPolicyCategories = require('./upsert-policy-categories');
const upsertPolicyHolders = require('./upsert-policy-holders');
const upsertPolicyInfos = require('./upsert-policy-infos');
const upsertUserAccounts = require('./upsert-user-accounts');

// last row wins when the same key appears more than once
const uniqueBy = (rows, keyOf) => [...new Map(rows.map(row => [keyOf(row), row])).values()];

// rows: normalized policy rows. Upserts agents, holders, categories, carriers, accounts, then policies; returns per-entity stats
const importPolicyRows = async (rows, onProgress = () => {}) => {
  try {
    onProgress('upserting agents, users, categories and carriers');
    const holders = uniqueBy(rows, row => row.email).map(({
      email, firstName, dob, address, phoneNumber, state, zipCode, gender, userType,
    }) => ({
      email, firstName, dob, address, phoneNumber, state, zipCode, gender, userType,
    }));
    const [agents, users, categories, carriers] = await Promise.all([
      upsertAgents([...new Set(rows.map(row => row.agent).filter(Boolean))]),
      upsertPolicyHolders(holders),
      upsertPolicyCategories([...new Set(rows.map(row => row.categoryName))]),
      upsertPolicyCarriers([...new Set(rows.map(row => row.companyName))]),
    ]);

    onProgress('upserting user accounts');
    const accountRows = uniqueBy(rows.filter(row => row.accountName), row => `${row.email}|${row.accountName}`);
    const accounts = await upsertUserAccounts(accountRows.map(row => ({ userId: users.ids.get(row.email), accountName: row.accountName })));

    onProgress('upserting policies');
    const policies = await upsertPolicyInfos(uniqueBy(rows, row => row.policyNumber).map(row => ({
      policyNumber: row.policyNumber,
      policyStartDate: row.policyStartDate,
      policyEndDate: row.policyEndDate,
      categoryId: categories.ids.get(row.categoryName),
      carrierId: carriers.ids.get(row.companyName),
      userId: users.ids.get(row.email),
    })));

    return {
      policiesCreated: policies.upsertedCount,
      policiesUpdated: policies.modifiedCount,
      agentsCreated: agents.upsertedCount,
      usersCreated: users.upsertedCount,
      userAccountsCreated: accounts.upsertedCount,
      categoriesCreated: categories.upsertedCount,
      carriersCreated: carriers.upsertedCount,
    };
  } catch (error) {
    logger.error(`ERROR FROM importPolicyRows ==> ${error}`);
    throw error;
  }
};

module.exports = importPolicyRows;
