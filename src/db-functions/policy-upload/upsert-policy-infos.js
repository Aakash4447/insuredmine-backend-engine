const { models } = require('../../models');

const upsertAndResolve = require('./upsert-and-resolve');

// policies: [{ policyNumber, policyStartDate, policyEndDate, categoryId, carrierId, userId }], unique by policyNumber
const upsertPolicyInfos = policies => upsertAndResolve({
  model: models.policyInfo,
  entries: policies.map(({ policyNumber, ...set }) => ({ filter: { policyNumber }, set })),
});

module.exports = upsertPolicyInfos;
