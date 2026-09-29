const { models } = require('../../models');
const escapeRegex = require('../../utils/escape-regex');
const logger = require('../../utils/logger');

const findPolicyHolderIds = require('./find-policy-holder-ids');

const POPULATE = [
  { path: 'user', select: 'firstName email phoneNumber dob address state zipCode gender userType' },
  { path: 'category', select: 'categoryName' },
  { path: 'carrier', select: 'companyName' },
];

// policies whose holder firstName contains `username` (case-insensitive); `email` limits the holders to one (non-ADMIN callers)
const searchPolicies = async ({
  username, email, page, limit,
}) => {
  try {
    const holderFilter = { firstName: { $regex: escapeRegex(username), $options: 'i' } };
    if (email) holderFilter.email = String(email);
    const filter = { userId: { $in: await findPolicyHolderIds(holderFilter) }, deletedAt: null };

    const [policies, total] = await Promise.all([
      models.policyInfo.find(filter).sort({ policyStartDate: -1, _id: 1 }).skip((page - 1) * limit).limit(limit)
        .populate(POPULATE),
      models.policyInfo.countDocuments(filter),
    ]);
    return { policies, total };
  } catch (error) {
    logger.error(`ERROR FROM searchPolicies ==> ${error}`);
    throw error;
  }
};

module.exports = searchPolicies;
