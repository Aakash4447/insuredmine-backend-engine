const { status } = require('http-status');

const { aggregatePoliciesByUser } = require('../../db-functions/policy');
const generateResponse = require('../../utils/generate-response');
const { buildPagination, getPagination } = require('../../utils/get-pagination');
const logger = require('../../utils/logger');

const aggregatePoliciesByUserController = async (req, res, next) => {
  try {
    const pagination = getPagination(req.query);

    // ADMIN sees every holder, other users only the holder registered with their own email
    const email = req.user.role === 'ADMIN' ? undefined : req.user.email;
    const { users, total } = await aggregatePoliciesByUser({ email, ...pagination });
    return res.status(status.OK).json(generateResponse('POLICIES_AGGREGATED', { users, pagination: buildPagination(pagination, total) }));
  } catch (error) {
    logger.error(`ERROR FROM aggregatePoliciesByUser ==> ${error}`);
    return next(error);
  }
};

module.exports = aggregatePoliciesByUserController;
