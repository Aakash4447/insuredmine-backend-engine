const bcrypt = require('bcryptjs');
const createHttpError = require('http-errors');
const { status } = require('http-status');

const { createUser, findUserByEmail } = require('../../db-functions/user');
const generateResponse = require('../../utils/generate-response');
const getMessage = require('../../utils/get-message');
const logger = require('../../utils/logger');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const register = async (req, res, next) => {
  try {
    const { body = {} } = req;
    if (!body.name) throw createHttpError(status.BAD_REQUEST, getMessage('NAME_REQUIRED'));
    if (!body.email) throw createHttpError(status.BAD_REQUEST, getMessage('EMAIL_REQUIRED'));
    if (!body.password) throw createHttpError(status.BAD_REQUEST, getMessage('PASSWORD_REQUIRED'));

    const name = String(body.name).trim();
    const email = String(body.email).trim().toLowerCase();
    const password = String(body.password);
    if (!name) throw createHttpError(status.BAD_REQUEST, getMessage('NAME_REQUIRED'));
    if (!EMAIL_REGEX.test(email)) throw createHttpError(status.BAD_REQUEST, getMessage('EMAIL_INVALID'));

    // soft-deleted users keep their email reserved because of the unique index
    const existing = await findUserByEmail(email, { withDeleted: true });
    if (existing) throw createHttpError(status.CONFLICT, getMessage('EMAIL_ALREADY_EXISTS'));

    const hashed = await bcrypt.hash(password, 10);
    let user;
    try {
      user = await createUser({ name, email, password: hashed });
    } catch (error) {
      if (error.code === 11000) throw createHttpError(status.CONFLICT, getMessage('EMAIL_ALREADY_EXISTS'));
      throw error;
    }

    return res.status(status.CREATED).json(generateResponse('USER_REGISTERED', user, status.CREATED));
  } catch (error) {
    logger.error(`ERROR FROM register ==> ${error}`);
    return next(error);
  }
};

module.exports = register;
