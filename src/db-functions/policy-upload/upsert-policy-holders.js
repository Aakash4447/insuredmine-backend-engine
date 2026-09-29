const { models } = require('../../models');

const upsertAndResolve = require('./upsert-and-resolve');

// holders: [{ email, firstName, dob, address, phoneNumber, state, zipCode, gender, userType }], unique by email
const upsertPolicyHolders = holders => upsertAndResolve({
  model: models.policyHolder,
  entries: holders.map(({ email, ...fields }) => ({
    filter: { email },
    set: Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== '')),
  })),
  lookup: { email: { $in: holders.map(holder => holder.email) } },
  keyOf: doc => doc.email,
});

module.exports = upsertPolicyHolders;
