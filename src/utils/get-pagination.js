const createHttpError = require('http-errors');
const { status } = require('http-status');

const getMessage = require('./get-message');

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// reads ?page (default 1) and ?limit (default 10, max 100) from a query object; throws 400 on anything else
const getPagination = ({ page = '1', limit = String(DEFAULT_LIMIT) } = {}) => {
  const values = [String(page), String(limit)];
  if (!values.every(value => /^[1-9]\d*$/.test(value))) throw createHttpError(status.BAD_REQUEST, getMessage('PAGINATION_INVALID'));
  const [pageNumber, limitNumber] = values.map(Number);
  if (limitNumber > MAX_LIMIT) throw createHttpError(status.BAD_REQUEST, getMessage('PAGINATION_INVALID'));
  return { page: pageNumber, limit: limitNumber };
};

const buildPagination = ({ page, limit }, total) => ({
  page, limit, total, totalPages: Math.ceil(total / limit),
});

module.exports = { buildPagination, getPagination };
