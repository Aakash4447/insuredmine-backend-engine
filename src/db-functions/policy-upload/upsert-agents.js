const { models } = require('../../models');

const upsertAndResolve = require('./upsert-and-resolve');

const upsertAgents = names => upsertAndResolve({
  model: models.agent,
  entries: names.map(name => ({ filter: { name } })),
  lookup: { name: { $in: names } },
  keyOf: doc => doc.name,
});

module.exports = upsertAgents;
