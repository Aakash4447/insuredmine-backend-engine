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
const users = [{
  userId: 'h1',
  user: { name: 'Ann', email: 'ann@example.com', phone: '555' },
  totalPolicies: 1,
  policies: [{
    id: 'p1', policyNumber: 'P1', categoryName: 'Auto', companyName: 'Acme',
  }],
}];

const aggregate = (query = '', token = bearer('a1')) => request(app).get(`/policies/aggregate-by-user${query}`).set('Authorization', token);
const pipeline = () => models.policyInfo.aggregate.mock.calls[0][0];

describe('GET /policies/aggregate-by-user', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    models.user.findOne.mockResolvedValue(admin);
    models.policyInfo.aggregate.mockResolvedValue([{ users, total: [{ count: 25 }] }]);
  });

  it('returns policies grouped by user with a total count, for every holder when ADMIN', async () => {
    const res = await aggregate();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Policies aggregated by user successfully',
      data: {
        users,
        pagination: {
          page: 1, limit: 10, total: 25, totalPages: 3,
        },
      },
    });
    expect(models.policyHolder.find).not.toHaveBeenCalled();
    const stages = pipeline();
    expect(stages[0]).not.toHaveProperty('$match');
    expect(stages.find(stage => stage.$group).$group).toMatchObject({ _id: '$userId', totalPolicies: { $sum: 1 } });
    expect(stages.find(stage => stage.$group).$group.policies.$push).toHaveProperty('policyNumber', '$policyNumber');
    expect(stages).toContainEqual({ $match: { 'holder.deletedAt': null } });
    expect(stages.find(stage => stage.$project).$project.user).toEqual({
      name: '$holder.firstName', email: '$holder.email', phone: '$holder.phoneNumber',
    });
  });

  it('paginates by user', async () => {
    const res = await aggregate('?page=2&limit=5');
    expect(res.body.data.pagination).toEqual({
      page: 2, limit: 5, total: 25, totalPages: 5,
    });
    expect(pipeline().at(-1).$facet.users).toEqual([{ $skip: 5 }, { $limit: 5 }]);
  });

  it('reports a zero total when nothing matches', async () => {
    models.policyInfo.aggregate.mockResolvedValue([{ users: [], total: [] }]);
    const res = await aggregate();
    expect(res.body.data).toEqual({
      users: [],
      pagination: {
        page: 1, limit: 10, total: 0, totalPages: 0,
      },
    });
  });

  it('restricts a non-ADMIN user to the holder registered with their own email', async () => {
    models.user.findOne.mockResolvedValue(member);
    models.policyHolder.find.mockReturnValue(mockQuery([{ _id: 'h1' }]));
    const res = await aggregate('', bearer('u2'));
    expect(res.status).toBe(200);
    expect(models.policyHolder.find).toHaveBeenCalledWith({ email: 'ann@example.com', deletedAt: null });
    expect(pipeline()[0]).toEqual({ $match: { userId: { $in: ['h1'] } } });
  });

  it.each(['?page=0', '?limit=101', '?limit=abc'])('returns 400 for invalid pagination (%s)', async query => {
    const res = await aggregate(query);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('page and limit must be positive integers and limit must not exceed 100');
    expect(models.policyInfo.aggregate).not.toHaveBeenCalled();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/policies/aggregate-by-user');
    expect(res.status).toBe(401);
  });

  it('returns 500 when the aggregation rejects', async () => {
    models.policyInfo.aggregate.mockRejectedValue(new Error('db down'));
    const res = await aggregate();
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Something went wrong');
  });
});
