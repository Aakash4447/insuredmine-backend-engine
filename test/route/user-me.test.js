const request = require('supertest');

require('../helpers/setup-env');
const { models } = require('../../src/models');
const buildApp = require('../helpers/build-app');
const { bearer, fakeUser } = require('../helpers/tokens');

jest.mock('../../src/models', () => require('../helpers/mock-models')); // eslint-disable-line n/global-require
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn() }));

const app = buildApp();

describe('GET /user/me', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns the authenticated user', async () => {
    models.user.findOne.mockResolvedValue(fakeUser());
    const res = await request(app).get('/user/me').set('Authorization', bearer('u1'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'User fetched successfully', data: fakeUser() });
    expect(models.user.findOne).toHaveBeenCalledWith({ _id: 'u1' });
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/user/me');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Authorization token is required');
  });
});
