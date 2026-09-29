const { models } = require('../../models');
const logger = require('../../utils/logger');

const findPendingMessages = async () => {
  try {
    return await models.scheduledMessage.find({ status: 'pending', deletedAt: null }).sort({ scheduledDate: 1 }).lean();
  } catch (error) {
    logger.error(`ERROR FROM findPendingMessages ==> ${error}`);
    throw error;
  }
};

module.exports = findPendingMessages;
