const { models } = require('../../models');
const logger = require('../../utils/logger');

// ids of the non-deleted policy holders matching `filter`
const findPolicyHolderIds = async filter => {
  try {
    const holders = await models.policyHolder.find({ ...filter, deletedAt: null }).select('_id').lean();
    return holders.map(holder => holder._id);
  } catch (error) {
    logger.error(`ERROR FROM findPolicyHolderIds ==> ${error}`);
    throw error;
  }
};

module.exports = findPolicyHolderIds;
