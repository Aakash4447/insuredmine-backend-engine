const crypto = require('node:crypto');

const softDelete = require('./plugins/soft-delete');
const toJson = require('./plugins/to-json');

module.exports = mongoose => {
  const schema = new mongoose.Schema({
    _id: { type: String, default: crypto.randomUUID },
    accountName: { type: String, required: true, trim: true },
    userId: { type: String, ref: 'policyHolder', required: true },
  }, { timestamps: true, collection: 'user_accounts' });

  schema.index({ userId: 1 });

  schema.plugin(softDelete);
  schema.plugin(toJson);

  return mongoose.model('userAccount', schema);
};
