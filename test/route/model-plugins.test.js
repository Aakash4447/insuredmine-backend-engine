const softDelete = require('../../src/models/plugins/soft-delete');
const toJson = require('../../src/models/plugins/to-json');

const fakeSchema = () => {
  const hooks = {};
  return {
    hooks,
    add: jest.fn(),
    set: jest.fn(),
    pre: jest.fn((name, fn) => Object.assign(hooks, { [name]: fn })),
    methods: {},
  };
};

const fakeQuery = ({ options = {}, filter = {} } = {}) => ({
  getOptions: () => options,
  getFilter: () => filter,
  where: jest.fn(),
});

describe('soft-delete plugin', () => {
  it('adds deletedAt and registers hooks for all query types and aggregate', () => {
    const schema = fakeSchema();
    softDelete(schema);
    expect(schema.add).toHaveBeenCalledWith({ deletedAt: { type: Date, default: null } });
    expect(Object.keys(schema.hooks).sort()).toEqual(
      ['aggregate', 'countDocuments', 'find', 'findOne', 'findOneAndUpdate', 'updateMany', 'updateOne'],
    );
  });

  it('filters out deleted docs on queries', () => {
    const schema = fakeSchema();
    softDelete(schema);
    const query = fakeQuery();
    schema.hooks.find.call(query);
    expect(query.where).toHaveBeenCalledWith({ deletedAt: null });
  });

  it('respects withDeleted and an explicit deletedAt filter', () => {
    const schema = fakeSchema();
    softDelete(schema);
    const withDeleted = fakeQuery({ options: { withDeleted: true } });
    schema.hooks.findOne.call(withDeleted);
    expect(withDeleted.where).not.toHaveBeenCalled();
    const explicit = fakeQuery({ filter: { deletedAt: null } });
    schema.hooks.findOne.call(explicit);
    expect(explicit.where).not.toHaveBeenCalled();
  });

  it('prepends a $match to aggregations unless withDeleted', () => {
    const schema = fakeSchema();
    softDelete(schema);
    const pipeline = [{ $limit: 1 }];
    schema.hooks.aggregate.call({ options: {}, pipeline: () => pipeline });
    expect(pipeline[0]).toEqual({ $match: { deletedAt: null } });
    const skipped = [{ $limit: 1 }];
    schema.hooks.aggregate.call({ options: { withDeleted: true }, pipeline: () => skipped });
    expect(skipped).toEqual([{ $limit: 1 }]);
  });

  it('adds a softDelete method that stamps deletedAt and saves', async () => {
    const schema = fakeSchema();
    softDelete(schema);
    const doc = { save: jest.fn().mockResolvedValue('saved') };
    await expect(schema.methods.softDelete.call(doc)).resolves.toBe('saved');
    expect(doc.deletedAt).toBeInstanceOf(Date);
  });
});

describe('to-json plugin', () => {
  it('maps _id to id and drops the version key', () => {
    const schema = fakeSchema();
    toJson(schema);
    const [name, options] = schema.set.mock.calls[0];
    expect(name).toBe('toJSON');
    expect(options).toMatchObject({ virtuals: true, versionKey: false });
    expect(options.transform({}, { _id: 'abc', name: 'x' })).toEqual({ id: 'abc', name: 'x' });
  });
});
