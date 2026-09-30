const createHttpError = require('http-errors');
const { status } = require('http-status');

const { searchPolicies } = require('../../db-functions/policy');
const generateResponse = require('../../utils/generate-response');
const getMessage = require('../../utils/get-message');
const { buildPagination, getPagination } = require('../../utils/get-pagination');
const logger = require('../../utils/logger');

const searchPoliciesController = async (req, res, next) => {
  try {
    const username = String(req.query.username || '').trim();
    if (!username) throw createHttpError(status.BAD_REQUEST, getMessage('USERNAME_REQUIRED'));
    const pagination = getPagination(req.query);

    // ADMIN searches every holder, other users only the holder registered with their own email
    const email = req.user.roles.includes('ADMIN') ? undefined : req.user.email;
    const { policies, total } = await searchPolicies({ username, email, ...pagination });
    return res.status(status.OK).json(generateResponse('POLICIES_FETCHED', { policies, pagination: buildPagination(pagination, total) }));
  } catch (error) {
    logger.error(`ERROR FROM searchPolicies ==> ${error}`);
    return next(error);
  }
};

module.exports = searchPoliciesController;
