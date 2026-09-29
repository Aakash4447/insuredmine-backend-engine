const { models } = require('../../models');
const logger = require('../../utils/logger');

const findPolicyHolderIds = require('./find-policy-holder-ids');

const joinOne = (from, localField, as) => [
  {
    $lookup: {
      from, localField, foreignField: '_id', as,
    },
  },
  { $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true } },
];

const buildPipeline = ({ userIds, page, limit }) => [
  ...(userIds ? [{ $match: { userId: { $in: userIds } } }] : []),
  ...joinOne('policy_categories', 'categoryId', 'category'),
  ...joinOne('policy_carriers', 'carrierId', 'carrier'),
  { $sort: { policyStartDate: -1, _id: 1 } },
  {
    $group: {
      _id: '$userId',
      totalPolicies: { $sum: 1 },
      policies: {
        $push: {
          id: '$_id',
          policyNumber: '$policyNumber',
          policyStartDate: '$policyStartDate',
          policyEndDate: '$policyEndDate',
          categoryName: '$category.categoryName',
          companyName: '$carrier.companyName',
        },
      },
    },
  },
  ...joinOne('policy_holders', '_id', 'holder'),
  { $match: { 'holder.deletedAt': null } },
  {
    $project: {
      _id: 0,
      userId: '$_id',
      user: { name: '$holder.firstName', email: '$holder.email', phone: '$holder.phoneNumber' },
      totalPolicies: 1,
      policies: 1,
    },
  },
  { $sort: { 'user.name': 1, userId: 1 } },
  { $facet: { users: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'count' }] } },
];

// one entry per user: { userId, user: { name, email, phone }, totalPolicies, policies: [...] }, paginated by user.
// `email` limits the result to that holder (non-ADMIN callers)
const aggregatePoliciesByUser = async ({ email, page, limit }) => {
  try {
    const userIds = email ? await findPolicyHolderIds({ email: String(email) }) : undefined;
    const [{ users, total }] = await models.policyInfo.aggregate(buildPipeline({ userIds, page, limit }));
    return { users, total: total.length ? total[0].count : 0 };
  } catch (error) {
    logger.error(`ERROR FROM aggregatePoliciesByUser ==> ${error}`);
    throw error;
  }
};

module.exports = aggregatePoliciesByUser;
