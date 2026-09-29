const { status } = require('http-status');

const getMessage = require('./get-message');

const generateResponse = (key, data = [], statusCode = status.OK) => ({
  success: statusCode < status.BAD_REQUEST,
  statusCode,
  message: getMessage(key),
  data,
});

module.exports = generateResponse;
