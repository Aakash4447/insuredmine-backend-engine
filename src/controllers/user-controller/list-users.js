const createHttpError = require('http-errors');
const { status } = require('http-status');

const { listUsers } = require('../../db-functions/user');
const generateResponse = require('../../utils/generate-response');
const getMessage = require('../../utils/get-message');
const logger = require('../../utils/logger');

const listUsersController = async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') throw createHttpError(status.FORBIDDEN, getMessage('FORBIDDEN'));

    const users = await listUsers();
    return res.status(status.OK).json(generateResponse('USERS_FETCHED', users));
  } catch (error) {
    logger.error(`ERROR FROM listUsers ==> ${error}`);
    return next(error);
  }
};

module.exports = listUsersController;
