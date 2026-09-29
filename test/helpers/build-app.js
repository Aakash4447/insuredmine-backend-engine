const express = require('express');
const { status } = require('http-status');

const router = require('../../src/route');
const errorHandler = require('../../src/utils/error-handler');
const generateResponse = require('../../src/utils/generate-response');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(router);
  app.use((req, res) => res.status(status.NOT_FOUND).json(generateResponse('ROUTE_NOT_FOUND', [], status.NOT_FOUND)));
  app.use(errorHandler);
  return app;
};

module.exports = buildApp;
