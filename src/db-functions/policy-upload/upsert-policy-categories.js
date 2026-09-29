const { models } = require('../../models');

const upsertAndResolve = require('./upsert-and-resolve');

const upsertPolicyCategories = names => upsertAndResolve({
  model: models.policyCategory,
  entries: names.map(categoryName => ({ filter: { categoryName } })),
  lookup: { categoryName: { $in: names } },
  keyOf: doc => doc.categoryName,
});

module.exports = upsertPolicyCategories;
