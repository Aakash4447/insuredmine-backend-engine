const { status } = require('http-status');

const generateResponse = require('./generate-response');
const getMessage = require('./get-message');
const logger = require('./logger');

// eslint-disable-next-line no-unused-vars
const errorHandler = (error, req, res, next) => {
  const statusCode = error.status || error.statusCode || status.INTERNAL_SERVER_ERROR;
  logger.error(`ERROR FROM errorHandler ==> ${error}`);
  const body = generateResponse('INTERNAL_SERVER_ERROR', [], statusCode);
  body.message = statusCode < status.INTERNAL_SERVER_ERROR ? error.message : getMessage('INTERNAL_SERVER_ERROR');
  return res.status(statusCode).json(body);
};

module.exports = errorHandler;
