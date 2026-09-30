const jwt = require('jsonwebtoken');
const request = require('supertest');

require('../helpers/setup-env');
const { models, mockQuery } = require('../../src/models');
const buildApp = require('../helpers/build-app');
const { bearer, fakeUser } = require('../helpers/tokens');

jest.mock('../../src/models', () => require('../helpers/mock-models')); // eslint-disable-line n/global-require
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn() }));

const app = buildApp();

describe.each(['/user/me', '/user/list'])('auth middleware on GET %s', path => {
  beforeEach(() => jest.resetAllMocks());

  const get = header => {
    const req = request(app).get(path);
    return header ? req.set('Authorization', header) : req;
  };

  it('returns 401 when the header is missing', async () => {
    const res = await get();
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, message: 'Authorization token is required' });
    expect(models.user.findOne).not.toHaveBeenCalled();
  });

  it.each(['Basic abc', 'Bearer', 'bearer abc', 'abc.def.ghi'])('returns 401 for non-Bearer header %j', async header => {
    const res = await get(header);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Authorization token is required');
  });

  it('returns 401 for a malformed token', async () => {
    const res = await get('Bearer not.a.jwt');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Authorization token is invalid or expired');
    expect(models.user.findOne).not.toHaveBeenCalled();
  });

  it('returns 401 for a token signed with another secret', async () => {
    const res = await get(`Bearer ${jwt.sign({ userId: 'u1' }, 'other-secret')}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Authorization token is invalid or expired');
  });

  it('returns 401 for an expired token', async () => {
    const res = await get(bearer('u1', { expiresIn: -10 }));
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Authorization token is invalid or expired');
  });

  it('returns 401 when the user no longer exists', async () => {
    models.user.findOne.mockResolvedValue(null);
    const res = await get(bearer('ghost'));
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('User not found');
    expect(models.user.findOne).toHaveBeenCalledWith({ _id: 'ghost' });
  });

  it('stringifies an object userId so it cannot inject operators', async () => {
    models.user.findOne.mockResolvedValue(null);
    await get(`Bearer ${jwt.sign({ userId: { $ne: '' } }, process.env.JWT_SECRET)}`);
    expect(models.user.findOne).toHaveBeenCalledWith({ _id: '[object Object]' });
  });

  it('returns 500 when the user lookup rejects', async () => {
    models.user.findOne.mockRejectedValue(new Error('db down'));
    const res = await get(bearer('u1'));
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Something went wrong');
  });

  it('passes through for a valid token', async () => {
    models.user.findOne.mockResolvedValue(fakeUser({ roles: ['ADMIN'] }));
    models.user.find.mockReturnValue(mockQuery([]));
    const res = await get(bearer('u1'));
    expect(res.status).toBe(200);
  });
});

describe('auth middleware role check on POST /policies/upload (ADMIN only)', () => {
  beforeEach(() => jest.resetAllMocks());

  const post = () => request(app).post('/policies/upload').set('Authorization', bearer('u1'));

  it('returns 401 when the user role is not allowed', async () => {
    models.user.findOne.mockResolvedValue(fakeUser({ roles: ['USER'] }));
    const res = await post();
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, message: 'You do not have permission to perform this action' });
  });

  it('lets an allowed role through to the next middleware', async () => {
    models.user.findOne.mockResolvedValue(fakeUser({ roles: ['ADMIN'] }));
    const res = await post();
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  it('lets a user with several roles through when any of them is allowed', async () => {
    models.user.findOne.mockResolvedValue(fakeUser({ roles: ['USER', 'ADMIN'] }));
    const res = await post();
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  it('returns 401 when the user only has the USER role in a roles array', async () => {
    models.user.findOne.mockResolvedValue(fakeUser({ roles: ['USER'] }));
    const res = await post();
    expect(res.status).toBe(401);
  });

  it('returns 401 when the user has no roles', async () => {
    models.user.findOne.mockResolvedValue(fakeUser({ roles: [] }));
    const res = await post();
    expect(res.status).toBe(401);
  });

  it('still returns 401 before checking roles when the token is missing', async () => {
    const res = await request(app).post('/policies/upload');
    expect(res.status).toBe(401);
  });
});
