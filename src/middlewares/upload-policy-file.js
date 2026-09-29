const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');

const createHttpError = require('http-errors');
const { status } = require('http-status');
const multer = require('multer');

const getMessage = require('../utils/get-message');

const ALLOWED_EXTENSIONS = ['.xlsx', '.csv'];
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: path.join(os.tmpdir(), 'insuredmine-uploads'),
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase())) return cb(null, true);
  return cb(createHttpError(status.BAD_REQUEST, getMessage('FILE_TYPE_INVALID')));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE, files: 1 } }).single('file');

const uploadPolicyFile = (req, res, next) => upload(req, res, error => {
  if (!error) return next();
  if (error instanceof multer.MulterError) {
    const key = error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'FILE_UPLOAD_FAILED';
    return next(createHttpError(status.BAD_REQUEST, getMessage(key)));
  }
  return next(error);
});

module.exports = uploadPolicyFile;
