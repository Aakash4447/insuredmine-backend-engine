const { models } = require('../../models');
const logger = require('../../utils/logger');

const createScheduledMessage = async ({ message, scheduledDate }) => {
  try {
    const scheduled = await models.scheduledMessage.create({ message, scheduledDate });
    return scheduled.toJSON();
  } catch (error) {
    logger.error(`ERROR FROM createScheduledMessage ==> ${error}`);
    throw error;
  }
};

module.exports = createScheduledMessage;
