const { models } = require('../../models');

const upsertAndResolve = require('./upsert-and-resolve');

const upsertPolicyCarriers = names => upsertAndResolve({
  model: models.policyCarrier,
  entries: names.map(companyName => ({ filter: { companyName } })),
  lookup: { companyName: { $in: names } },
  keyOf: doc => doc.companyName,
});

module.exports = upsertPolicyCarriers;
