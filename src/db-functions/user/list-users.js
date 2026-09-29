const { models } = require('../../models');
const logger = require('../../utils/logger');

const listUsers = async () => {
  try {
    return await models.user.find({ deletedAt: null }).sort({ createdAt: -1 });
  } catch (error) {
    logger.error(`ERROR FROM listUsers ==> ${error}`);
    throw error;
  }
};

module.exports = listUsers;
