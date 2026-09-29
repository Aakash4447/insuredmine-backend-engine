const { status } = require('http-status');

const generateResponse = require('../../utils/generate-response');
const logger = require('../../utils/logger');

const getMe = (req, res, next) => {
  try {
    return res.status(status.OK).json(generateResponse('USER_FETCHED', req.user));
  } catch (error) {
    logger.error(`ERROR FROM getMe ==> ${error}`);
    return next(error);
  }
};

module.exports = getMe;
