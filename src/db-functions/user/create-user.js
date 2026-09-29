const { models } = require('../../models');
const logger = require('../../utils/logger');

const createUser = async ({ name, email, password }) => {
  try {
    const user = await models.user.create({ name, email, password });
    const { password: removed, ...safeUser } = user.toJSON();
    return safeUser;
  } catch (error) {
    logger.error(`ERROR FROM createUser ==> ${error}`);
    throw error;
  }
};

module.exports = createUser;
