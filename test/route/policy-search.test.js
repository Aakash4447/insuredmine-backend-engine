const request = require('supertest');

require('../helpers/setup-env');
const { models, mockQuery } = require('../../src/models');
const buildApp = require('../helpers/build-app');
const { bearer, fakeUser } = require('../helpers/tokens');

jest.mock('../../src/models', () => require('../helpers/mock-models')); // eslint-disable-line n/global-require
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn() }));

const app = buildApp();
const admin = fakeUser({ id: 'a1', role: 'ADMIN', email: 'admin@example.com' });
const member = fakeUser({ id: 'u2', email: 'ann@example.com' });
const policies = [{
  id: 'p1', policyNumber: 'P1', user: { firstName: 'Ann' }, category: { categoryName: 'Auto' }, carrier: { companyName: 'Acme' },
}];

const search = (query = '?username=an', token = bearer('a1')) => request(app).get(`/policies/search${query}`).set('Authorization', token);

describe('GET /policies/search', () => {
  let holderQuery;
  let policyQuery;

  beforeEach(() => {
    jest.resetAllMocks();
    models.user.findOne.mockResolvedValue(admin);
    holderQuery = mockQuery([{ _id: 'h1' }, { _id: 'h2' }]);
    policyQuery = mockQuery(policies);
    models.policyHolder.find.mockReturnValue(holderQuery);
    models.policyInfo.find.mockReturnValue(policyQuery);
    models.policyInfo.countDocuments.mockResolvedValue(11);
  });

  it('returns populated policies for holders whose firstName matches, across all holders for ADMIN', async () => {
    const res = await search('?username=%20an%20');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Policies fetched successfully',
      data: {
        policies,
        pagination: {
          page: 1, limit: 10, total: 11, totalPages: 2,
        },
      },
    });
    expect(models.policyHolder.find).toHaveBeenCalledWith({ firstName: { $regex: 'an', $options: 'i' }, deletedAt: null });
    const filter = { userId: { $in: ['h1', 'h2'] }, deletedAt: null };
    expect(models.policyInfo.find).toHaveBeenCalledWith(filter);
    expect(models.policyInfo.countDocuments).toHaveBeenCalledWith(filter);
    expect(policyQuery.populate).toHaveBeenCalledWith([
      expect.objectContaining({ path: 'user' }),
      { path: 'category', select: 'categoryName' },
      { path: 'carrier', select: 'companyName' },
    ]);
  });

  it('escapes regex characters in the username', async () => {
    await search('?username=a.*(b');
    expect(models.policyHolder.find.mock.calls[0][0].firstName.$regex).toBe('a\\.\\*\\(b');
  });

  it('does not accept a nested query object as the username', async () => {
    const res = await search('?username[$ne]=x');
    expect(res.status).toBe(400);
    expect(models.policyHolder.find).not.toHaveBeenCalled();
  });

  it('applies page and limit', async () => {
    const res = await search('?username=an&page=3&limit=5');
    expect(res.body.data.pagination).toEqual({
      page: 3, limit: 5, total: 11, totalPages: 3,
    });
    expect(policyQuery.skip).toHaveBeenCalledWith(10);
    expect(policyQuery.limit).toHaveBeenCalledWith(5);
  });

  it('limits a non-ADMIN user to the holder registered with their own email', async () => {
    models.user.findOne.mockResolvedValue(member);
    const res = await search('?username=an', bearer('u2'));
    expect(res.status).toBe(200);
    expect(models.policyHolder.find).toHaveBeenCalledWith({
      firstName: { $regex: 'an', $options: 'i' }, email: 'ann@example.com', deletedAt: null,
    });
  });

  it('returns an empty page when no holder matches', async () => {
    holderQuery = mockQuery([]);
    models.policyHolder.find.mockReturnValue(holderQuery);
    models.policyInfo.find.mockReturnValue(mockQuery([]));
    models.policyInfo.countDocuments.mockResolvedValue(0);
    const res = await search('?username=zzz');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      policies: [],
      pagination: {
        page: 1, limit: 10, total: 0, totalPages: 0,
      },
    });
    expect(models.policyInfo.find).toHaveBeenCalledWith({ userId: { $in: [] }, deletedAt: null });
  });

  it.each(['', '?username=', '?username=%20%20'])('returns 400 when the username is missing (%s)', async query => {
    const res = await search(query);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Username is required');
    expect(models.policyHolder.find).not.toHaveBeenCalled();
  });

  it.each(['&page=0', '&page=abc', '&limit=0', '&limit=101', '&limit=1.5', '&page=-1'])('returns 400 for invalid pagination (%s)', async extra => {
    const res = await search(`?username=an${extra}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('page and limit must be positive integers and limit must not exceed 100');
    expect(models.policyInfo.find).not.toHaveBeenCalled();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/policies/search?username=an');
    expect(res.status).toBe(401);
  });

  it('returns 500 when the query rejects', async () => {
    models.policyInfo.find.mockReturnValue(mockQuery(null, new Error('db down')));
    const res = await search();
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Something went wrong');
  });
});
