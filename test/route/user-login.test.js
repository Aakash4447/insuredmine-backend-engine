const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');

require('../helpers/setup-env');
const { models, mockQuery } = require('../../src/models');
const buildApp = require('../helpers/build-app');

jest.mock('../../src/models', () => require('../helpers/mock-models')); // eslint-disable-line n/global-require
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn() }));

const app = buildApp();
let hash;
beforeAll(async () => {
  hash = await bcrypt.hash('secret123', 4);
});
const dbUser = () => ({
  id: 'u1',
  password: hash,
  toJSON: () => ({
    id: 'u1', name: 'Test', email: 'test@example.com', role: 'USER', password: 'hash',
  }),
});

describe('POST /user/login', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    models.user.findOne.mockReturnValue(mockQuery(dbUser()));
  });

  it('logs in and returns tokens without the password', async () => {
    const res = await request(app).post('/user/login').send({ email: ' Test@Example.com ', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged in successfully');
    expect(res.body.data.user).toEqual({
      id: 'u1', name: 'Test', email: 'test@example.com', role: 'USER',
    });
    const access = jwt.verify(res.body.data.accessToken, process.env.JWT_SECRET);
    const refresh = jwt.verify(res.body.data.refreshToken, process.env.JWT_SECRET);
    expect(access.userId).toBe('u1');
    expect(refresh.userId).toBe('u1');
    expect(refresh.exp - refresh.iat).toBe(7 * 24 * 3600);
    expect(access.exp - access.iat).toBe(3600);
    expect(models.user.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    expect(models.user.findOne.mock.results[0].value.select).toHaveBeenCalledWith('+password');
    expect(models.user.findOne.mock.results[0].value.setOptions).toHaveBeenCalledWith({ withDeleted: false });
  });

  it.each([
    [{ password: 'x' }, 'Email is required'],
    [{ email: 'a@b.com' }, 'Password is required'],
    [{}, 'Email is required'],
  ])('returns 400 for body %j', async (body, message) => {
    const res = await request(app).post('/user/login').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, message, data: [] });
    expect(models.user.findOne).not.toHaveBeenCalled();
  });

  it('returns 400 for a missing body', async () => {
    const res = await request(app).post('/user/login');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email is required');
  });

  it('returns 401 for an unknown user', async () => {
    models.user.findOne.mockReturnValue(mockQuery(null));
    const res = await request(app).post('/user/login').send({ email: 'x@y.com', password: 'secret123' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('returns 401 for a wrong password', async () => {
    const res = await request(app).post('/user/login').send({ email: 'test@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('does not let operator objects reach the query (email is stringified)', async () => {
    models.user.findOne.mockReturnValue(mockQuery(null));
    const res = await request(app).post('/user/login').send({ email: { $ne: '' }, password: { $ne: '' } });
    expect(res.status).toBe(401);
    expect(models.user.findOne).toHaveBeenCalledWith({ email: '[object object]' });
  });

  it('returns 500 when the lookup rejects', async () => {
    models.user.findOne.mockReturnValue(mockQuery(null, new Error('db down')));
    const res = await request(app).post('/user/login').send({ email: 'a@b.com', password: 'x' });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Something went wrong');
  });
});
