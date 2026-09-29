const bcrypt = require('bcryptjs');

const { models } = require('../models');
const logger = require('../utils/logger');

const dummyUsers = require('./data/dummy-users');

const seedDummyUsers = async () => {
  try {
    await Promise.all(dummyUsers.map(async dummyUser => {
      const exists = await models.user.exists({ email: dummyUser.email });
      if (exists) return;
      const password = await bcrypt.hash(dummyUser.password, 10);
      await models.user.create({ ...dummyUser, password });
      logger.info(`Seeded dummy user ${dummyUser.email}`);
    }));
  } catch (error) {
    logger.error(`ERROR FROM seedDummyUsers ==> ${error}`);
    throw error;
  }
};

module.exports = seedDummyUsers;
