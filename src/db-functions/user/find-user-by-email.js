const { models } = require('../../models');
const logger = require('../../utils/logger');

const findUserByEmail = async (email, { withPassword = false, withDeleted = false } = {}) => {
  try {
    const query = models.user.findOne({ email: String(email).trim().toLowerCase() }).setOptions({ withDeleted });
    if (withPassword) query.select('+password');
    return await query;
  } catch (error) {
    logger.error(`ERROR FROM findUserByEmail ==> ${error}`);
    throw error;
  }
};

module.exports = findUserByEmail;
