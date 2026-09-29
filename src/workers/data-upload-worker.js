const fs = require('node:fs/promises');
const { parentPort, workerData } = require('node:worker_threads');

const { importPolicyRows } = require('../db-functions/policy-upload');
const { connectDb, disconnectDb } = require('../models');
const logger = require('../utils/logger');
const normalizePolicyRow = require('../utils/normalize-policy-row');
const parseUploadFile = require('../utils/parse-upload-file');

const MAX_REPORTED_ERRORS = 20;

const run = async () => {
  const { filePath } = workerData;
  const startedAt = Date.now();
  const progress = message => parentPort.postMessage({ type: 'progress', message });

  try {
    await connectDb();

    progress('parsing file');
    const rawRows = await parseUploadFile(filePath);
    const rows = [];
    const skippedRowErrors = [];
    rawRows.forEach((raw, index) => {
      const { row, error } = normalizePolicyRow(raw);
      if (row) rows.push(row);
      // +2: one for the header line, one for 1-based numbering
      else if (skippedRowErrors.length < MAX_REPORTED_ERRORS) skippedRowErrors.push({ row: index + 2, error });
    });

    const stats = rows.length ? await importPolicyRows(rows, progress) : {};
    parentPort.postMessage({
      type: 'done',
      result: {
        totalRows: rawRows.length,
        recordsImported: rows.length,
        recordsSkipped: rawRows.length - rows.length,
        skippedRowErrors,
        ...stats,
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    logger.error(`ERROR FROM dataUploadWorker ==> ${error}`);
    parentPort.postMessage({ type: 'error', message: error.message });
  } finally {
    await fs.rm(filePath, { force: true });
    await disconnectDb();
  }
};

run();
