const request = require('supertest');

require('../helpers/setup-env');
const { models, mockQuery } = require('../../src/models');
const buildApp = require('../helpers/build-app');
const { bearer, fakeUser } = require('../helpers/tokens');

jest.mock('../../src/models', () => require('../helpers/mock-models')); // eslint-disable-line n/global-require
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn() }));

const app = buildApp();
const users = [fakeUser({ id: 'a1', roles: ['ADMIN'] }), fakeUser({ id: 'u2' })];

describe('GET /user/list', () => {
  beforeEach(() => jest.resetAllMocks());

  it('lists non-deleted users, newest first, for ADMIN', async () => {
    models.user.findOne.mockResolvedValue(users[0]);
    const query = mockQuery(users);
    models.user.find.mockReturnValue(query);
    const res = await request(app).get('/user/list').set('Authorization', bearer('a1'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'Users fetched successfully', data: users });
    expect(models.user.find).toHaveBeenCalledWith({ deletedAt: null });
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it('returns 401 for a non-ADMIN user without querying users', async () => {
    models.user.findOne.mockResolvedValue(users[1]);
    const res = await request(app).get('/user/list').set('Authorization', bearer('u2'));
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('You do not have permission to perform this action');
    expect(models.user.find).not.toHaveBeenCalled();
  });

  it('returns 500 when the query rejects', async () => {
    models.user.findOne.mockResolvedValue(users[0]);
    models.user.find.mockReturnValue(mockQuery(null, new Error('db down')));
    const res = await request(app).get('/user/list').set('Authorization', bearer('a1'));
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Something went wrong');
  });
});
