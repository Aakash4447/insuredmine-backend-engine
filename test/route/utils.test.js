const jwt = require('jsonwebtoken');

require('../helpers/setup-env');
const errorHandler = require('../../src/utils/error-handler');
const generateResponse = require('../../src/utils/generate-response');
const { decodeToken, generateRefreshToken, generateToken } = require('../../src/utils/generate-token');
const getMessage = require('../../src/utils/get-message');

jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn() }));

describe('getMessage', () => {
  it('maps known keys', () => expect(getMessage('EMAIL_REQUIRED')).toBe('Email is required'));
  it('falls back to the key', () => expect(getMessage('UNKNOWN_KEY')).toBe('UNKNOWN_KEY'));
});

describe('generateResponse', () => {
  it('defaults to 200 with empty data', () => {
    expect(generateResponse('VERSION_FETCHED')).toEqual({
      success: true, statusCode: 200, message: 'Version fetched successfully', data: [],
    });
  });

  it('marks status >= 400 as unsuccessful', () => {
    expect(generateResponse('UNAUTHORIZED', [], 403)).toMatchObject({ success: false, statusCode: 403 });
  });
});

describe('generate-token', () => {
  it('round-trips access and refresh tokens with their lifetimes', () => {
    const access = decodeToken(generateToken({ userId: 'u1' }));
    const refresh = decodeToken(generateRefreshToken({ userId: 'u1' }));
    expect(access.userId).toBe('u1');
    expect(access.exp - access.iat).toBe(3600);
    expect(refresh.exp - refresh.iat).toBe(7 * 24 * 3600);
  });

  it('throws on a token signed with another secret', () => {
    expect(() => decodeToken(jwt.sign({ a: 1 }, 'x'))).toThrow();
  });
});

describe('errorHandler', () => {
  const run = error => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    errorHandler(error, {}, res, jest.fn());
    return res;
  };

  it('exposes the message for 4xx errors', () => {
    const res = run(Object.assign(new Error('bad'), { status: 400 }));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toBe('bad');
  });

  it('hides the message and defaults to 500 otherwise', () => {
    const res = run(new Error('secret detail'));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toBe('Something went wrong');
  });
});
