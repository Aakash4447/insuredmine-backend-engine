// thenable query stand-in: chainable setOptions/select/sort/lean, resolves (or rejects) when awaited
const mockQuery = (result, error) => {
  const query = {
    setOptions: jest.fn(() => query),
    select: jest.fn(() => query),
    sort: jest.fn(() => query),
    lean: jest.fn(() => query),
    populate: jest.fn(() => query),
    skip: jest.fn(() => query),
    limit: jest.fn(() => query),
    then: (resolve, reject) => (error ? Promise.reject(error) : Promise.resolve(result)).then(resolve, reject),
  };
  return query;
};

const bulkModel = () => ({
  aggregate: jest.fn(), bulkWrite: jest.fn(), countDocuments: jest.fn(), find: jest.fn(),
});

const models = {
  user: {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  },
  scheduledMessage: {
    create: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  agent: bulkModel(),
  policyCarrier: bulkModel(),
  policyCategory: bulkModel(),
  policyHolder: bulkModel(),
  policyInfo: bulkModel(),
  userAccount: bulkModel(),
};

module.exports = {
  mongoose: {},
  models,
  connectDb: jest.fn(),
  disconnectDb: jest.fn(),
  mockQuery,
};
