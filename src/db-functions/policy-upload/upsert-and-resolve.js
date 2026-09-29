const crypto = require('node:crypto');

const logger = require('../../utils/logger');

const CHUNK_SIZE = 1000;

// Bulk upserts `entries` ({ filter, set }) in chunks; soft-deleted docs are matched too so unique keys never collide.
// When `lookup` is given, the resulting docs are read back and returned as a Map of keyOf(doc) => _id.
const upsertAndResolve = async ({
  model, entries, lookup, keyOf,
}) => {
  try {
    const totals = { upsertedCount: 0, modifiedCount: 0 };
    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const operations = entries.slice(i, i + CHUNK_SIZE).map(({ filter, set = {} }) => ({
        updateOne: {
          filter,
          update: {
            ...(Object.keys(set).length ? { $set: set } : {}),
            $setOnInsert: { _id: crypto.randomUUID(), deletedAt: null },
          },
          upsert: true,
          // the schema default for _id (crypto.randomUUID) is called with a doc argument and throws, so ids and deletedAt are set explicitly
          setDefaultsOnInsert: false,
        },
      }));
      // eslint-disable-next-line no-await-in-loop
      const result = await model.bulkWrite(operations, { ordered: false });
      // with ordered:false Mongoose reports casting/validation failures on the result instead of throwing
      if (result.mongoose?.validationErrors?.length) throw result.mongoose.validationErrors[0];
      totals.upsertedCount += result.upsertedCount;
      totals.modifiedCount += result.modifiedCount;
    }

    const ids = new Map();
    if (lookup) {
      const docs = await model.find(lookup).setOptions({ withDeleted: true }).lean();
      docs.forEach(doc => ids.set(keyOf(doc), doc._id));
    }
    return { ids, ...totals };
  } catch (error) {
    logger.error(`ERROR FROM upsertAndResolve ==> ${error}`);
    throw error;
  }
};

module.exports = upsertAndResolve;
