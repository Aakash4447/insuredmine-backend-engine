const createHttpError = require('http-errors');
const { status } = require('http-status');

const generateResponse = require('../../utils/generate-response');
const getMessage = require('../../utils/get-message');
const logger = require('../../utils/logger');
const runUploadWorker = require('../../utils/run-upload-worker');

const uploadPolicies = async (req, res, next) => {
  try {
    if (!req.file) throw createHttpError(status.BAD_REQUEST, getMessage('FILE_REQUIRED'));

    const result = await runUploadWorker(req.file.path);
    return res.status(status.OK).json(generateResponse('POLICIES_UPLOADED', result));
  } catch (error) {
    logger.error(`ERROR FROM uploadPolicies ==> ${error}`);
    return next(error);
  }
};

module.exports = uploadPolicies;
