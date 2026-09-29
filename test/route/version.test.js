const request = require('supertest');

require('../helpers/setup-env');
const { version } = require('../../package.json');
const buildApp = require('../helpers/build-app');

jest.mock('../../src/models', () => require('../helpers/mock-models')); // eslint-disable-line n/global-require
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn() }));

const app = buildApp();

describe('GET /version', () => {
  it('returns the package version', async () => {
    const res = await request(app).get('/version');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true, statusCode: 200, message: 'Version fetched successfully', data: { version },
    });
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false, statusCode: 404, message: 'Route not found', data: [],
    });
  });
});
