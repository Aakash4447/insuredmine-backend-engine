const fs = require('node:fs/promises');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

const logger = require('./logger');

const WORKER_PATH = path.join(__dirname, '..', 'workers', 'data-upload-worker.js');

// runs the upload worker for `filePath`; resolves with the worker's result stats, rejects if it reports an error or dies
const runUploadWorker = filePath => new Promise((resolve, reject) => {
  const worker = new Worker(WORKER_PATH, { workerData: { filePath } });
  let result = null;

  worker.on('message', message => {
    if (message.type === 'progress') logger.info(`dataUploadWorker: ${message.message}`);
    else if (message.type === 'done') result = message.result;
    else if (message.type === 'error') reject(new Error(message.message));
  });
  worker.on('error', reject);
  worker.on('exit', code => {
    if (result) resolve(result);
    else reject(new Error(`Upload worker stopped with exit code ${code}`));
  });
}).finally(() => fs.rm(filePath, { force: true })); // no-op when the worker already removed it (covers worker crashes)

module.exports = runUploadWorker;
