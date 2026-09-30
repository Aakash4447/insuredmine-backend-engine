const createHttpError = require('http-errors');
const { status } = require('http-status');

const { models } = require('../models');
const { decodeToken } = require('../utils/generate-token');
const getMessage = require('../utils/get-message');
const logger = require('../utils/logger');

// roles is optional: when given, the user must also have at least one of them, otherwise only authentication is checked
const auth = (roles = []) => async (req, res, next) => {
  try {
    const { headers: { authorization } } = req;
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw createHttpError(status.UNAUTHORIZED, getMessage('TOKEN_REQUIRED'));
    }

    let decoded;
    try {
      decoded = decodeToken(authorization.slice('Bearer '.length));
    } catch {
      throw createHttpError(status.UNAUTHORIZED, getMessage('TOKEN_INVALID'));
    }

    const user = await models.user.findOne({ _id: String(decoded.userId) });
    if (!user) throw createHttpError(status.UNAUTHORIZED, getMessage('USER_NOT_FOUND'));

    if (roles.length && !roles.some(role => (user.roles || []).includes(role))) {
      throw createHttpError(status.UNAUTHORIZED, getMessage('UNAUTHORIZED'));
    }

    req.user = user;
    return next();
  } catch (error) {
    logger.error(`ERROR FROM auth ==> ${error}`);
    return next(error);
  }
};

module.exports = auth;
