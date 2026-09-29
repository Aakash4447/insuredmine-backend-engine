const { models } = require('../../models');
const logger = require('../../utils/logger');

// atomically moves a message from 'pending' to `status`; resolves to null when it was not pending
// (already executed, e.g. by another instance), so a message can never run twice
const updatePendingMessageStatus = async (id, status) => {
  try {
    return await models.scheduledMessage.findOneAndUpdate({ _id: String(id), status: 'pending' }, { status }, { returnDocument: 'after' });
  } catch (error) {
    logger.error(`ERROR FROM updatePendingMessageStatus ==> ${error}`);
    throw error;
  }
};

module.exports = updatePendingMessageStatus;
