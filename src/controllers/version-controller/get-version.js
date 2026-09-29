const { status } = require('http-status');

const { version } = require('../../../package.json');
const generateResponse = require('../../utils/generate-response');
const logger = require('../../utils/logger');

const getVersion = (req, res, next) => {
  try {
    return res.status(status.OK).json(generateResponse('VERSION_FETCHED', { version }));
  } catch (error) {
    logger.error(`ERROR FROM getVersion ==> ${error}`);
    return next(error);
  }
};

module.exports = getVersion;
