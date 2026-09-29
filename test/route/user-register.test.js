const request = require('supertest');

require('../helpers/setup-env');
const { models, mockQuery } = require('../../src/models');
const buildApp = require('../helpers/build-app');

jest.mock('../../src/models', () => require('../helpers/mock-models')); // eslint-disable-line n/global-require
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn() }));

const app = buildApp();
const valid = { name: 'Test', email: 'test@example.com', password: 'secret123' };

const created = () => ({
  toJSON: () => ({
    id: 'u1', name: 'Test', email: 'test@example.com', password: 'hash',
  }),
});

describe('POST /user/register', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    models.user.findOne.mockReturnValue(mockQuery(null));
    models.user.create.mockResolvedValue(created());
  });

  it('creates a user, hashing the password and omitting it from the response', async () => {
    const res = await request(app).post('/user/register').send({ name: '  Test ', email: ' Test@Example.COM ', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      success: true, statusCode: 201, message: 'User registered successfully', data: { id: 'u1', email: 'test@example.com' },
    });
    expect(res.body.data.password).toBeUndefined();
    expect(models.user.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    const query = models.user.findOne.mock.results[0].value;
    expect(query.setOptions).toHaveBeenCalledWith({ withDeleted: true });
    const arg = models.user.create.mock.calls[0][0];
    expect(arg).toMatchObject({ name: 'Test', email: 'test@example.com' });
    expect(arg.password).not.toBe('secret123');
    expect(arg.password).toMatch(/^\$2[aby]\$10\$/);
  });

  it.each([
    ['name', 'Name is required'],
    ['email', 'Email is required'],
    ['password', 'Password is required'],
  ])('returns 400 when %s is missing', async (field, message) => {
    const body = Object.fromEntries(Object.entries(valid).filter(([key]) => key !== field));
    const res = await request(app).post('/user/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false, statusCode: 400, message, data: [],
    });
    expect(models.user.create).not.toHaveBeenCalled();
  });

  it('returns 400 for a missing body', async () => {
    const res = await request(app).post('/user/register');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Name is required');
  });

  it('returns 400 for a whitespace-only name', async () => {
    const res = await request(app).post('/user/register').send({ ...valid, name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Name is required');
  });

  it.each(['plainaddress', 'a@b', 'a b@c.com', '@example.com'])('returns 400 for invalid email %s', async email => {
    const res = await request(app).post('/user/register').send({ ...valid, email });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email is invalid');
  });

  it('neutralizes operator injection in email (object is stringified, rejected as invalid)', async () => {
    const res = await request(app).post('/user/register').send({ ...valid, email: { $ne: '' } });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email is invalid');
    expect(models.user.findOne).not.toHaveBeenCalled();
  });

  it('stringifies non-string name and password before use', async () => {
    const res = await request(app).post('/user/register').send({ ...valid, name: { $gt: '' }, password: 12345 });
    expect(res.status).toBe(201);
    const arg = models.user.create.mock.calls[0][0];
    expect(typeof arg.name).toBe('string');
    expect(typeof arg.password).toBe('string');
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app).post('/user/register').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 409 when the email already exists (including soft-deleted users)', async () => {
    models.user.findOne.mockReturnValue(mockQuery({ id: 'u9' }));
    const res = await request(app).post('/user/register').send(valid);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Email already exists');
    expect(models.user.create).not.toHaveBeenCalled();
  });

  it('returns 409 on a duplicate-key error from create (race)', async () => {
    models.user.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    const res = await request(app).post('/user/register').send(valid);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Email already exists');
  });

  it('returns 500 with a generic message when create rejects', async () => {
    models.user.create.mockRejectedValue(new Error('db down'));
    const res = await request(app).post('/user/register').send(valid);
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false, statusCode: 500, message: 'Something went wrong' });
  });

  it('returns 500 when the email lookup rejects', async () => {
    models.user.findOne.mockReturnValue(mockQuery(null, new Error('db down')));
    const res = await request(app).post('/user/register').send(valid);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Something went wrong');
  });
});
