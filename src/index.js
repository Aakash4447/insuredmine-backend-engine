require('dotenv/config');

const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const createHttpError = require('http-errors');
const { status } = require('http-status');

const { seedDummyUsers } = require('./boot');
const { connectDb, disconnectDb } = require('./models');
const router = require('./route');
const { startCpuMonitor } = require('./utils/cpu-monitor');
const errorHandler = require('./utils/error-handler');
const getMessage = require('./utils/get-message');
const logger = require('./utils/logger');
const { loadPendingMessages } = require('./utils/message-scheduler');

const FORCE_EXIT_MS = 10000;

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});
app.use(router);
app.use((req, res, next) => next(createHttpError(status.NOT_FOUND, getMessage('ROUTE_NOT_FOUND'))));
app.use(errorHandler);

const start = async () => {
  try {
    await connectDb();
  } catch (error) {
    logger.error(`ERROR FROM connectDb ==> ${error}`);
    process.exitCode = 1;
    return;
  }

  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    logger.info(`Server running in ${process.env.NODE_ENV.toUpperCase()} mode on port ${PORT}`);
    seedDummyUsers().catch(error => logger.error(`ERROR FROM boot ==> ${error}`));
    loadPendingMessages().catch(error => logger.error(`ERROR FROM loadPendingMessages ==> ${error}`));
  });

  const shutdown = async () => {
    server.close();
    await disconnectDb();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // exit non-zero on high CPU so a process manager (e.g. PM2) restarts the app; force the exit if cleanup hangs
  startCpuMonitor({
    onExceed: async () => {
      setTimeout(() => process.exit(1), FORCE_EXIT_MS).unref(); // eslint-disable-line n/no-process-exit
      try {
        await shutdown();
      } catch (error) {
        logger.error(`ERROR FROM cpuRestart ==> ${error}`);
      }
      process.exit(1); // eslint-disable-line n/no-process-exit
    },
  });
};

start();
