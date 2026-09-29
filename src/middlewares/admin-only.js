const createHttpError = require('http-errors');
const { status } = require('http-status');

const getMessage = require('../utils/get-message');

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'ADMIN') return next(createHttpError(status.FORBIDDEN, getMessage('FORBIDDEN')));
  return next();
};

module.exports = adminOnly;
