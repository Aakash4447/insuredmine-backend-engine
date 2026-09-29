const bcrypt = require('bcryptjs');
const createHttpError = require('http-errors');
const { status } = require('http-status');

const { findUserByEmail } = require('../../db-functions/user');
const generateResponse = require('../../utils/generate-response');
const { generateRefreshToken, generateToken } = require('../../utils/generate-token');
const getMessage = require('../../utils/get-message');
const logger = require('../../utils/logger');

const login = async (req, res, next) => {
  try {
    const { body = {} } = req;
    if (!body.email) throw createHttpError(status.BAD_REQUEST, getMessage('EMAIL_REQUIRED'));
    if (!body.password) throw createHttpError(status.BAD_REQUEST, getMessage('PASSWORD_REQUIRED'));

    const user = await findUserByEmail(body.email, { withPassword: true });
    const isMatch = user ? await bcrypt.compare(String(body.password), user.password) : false;
    if (!isMatch) throw createHttpError(status.UNAUTHORIZED, getMessage('INVALID_CREDENTIALS'));

    const payload = { userId: user.id };
    const { password, ...safeUser } = user.toJSON();
    const data = {
      user: safeUser,
      accessToken: generateToken(payload),
      refreshToken: generateRefreshToken(payload),
    };
    return res.status(status.OK).json(generateResponse('LOGIN_SUCCESS', data));
  } catch (error) {
    logger.error(`ERROR FROM login ==> ${error}`);
    return next(error);
  }
};

module.exports = login;
