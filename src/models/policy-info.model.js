const crypto = require('node:crypto');

const softDelete = require('./plugins/soft-delete');
const toJson = require('./plugins/to-json');

module.exports = mongoose => {
  const schema = new mongoose.Schema({
    _id: { type: String, default: crypto.randomUUID },
    policyNumber: {
      type: String, required: true, unique: true, trim: true,
    },
    policyStartDate: { type: Date, required: true },
    policyEndDate: { type: Date, required: true },
    categoryId: { type: String, ref: 'policyCategory', required: true },
    carrierId: { type: String, ref: 'policyCarrier', required: true },
    userId: { type: String, ref: 'policyHolder', required: true },
  }, { timestamps: true, collection: 'policy_infos' });

  schema.index({ userId: 1 });
  schema.index({ categoryId: 1 });
  schema.index({ carrierId: 1 });

  [['user', 'policyHolder', 'userId'], ['category', 'policyCategory', 'categoryId'], ['carrier', 'policyCarrier', 'carrierId']]
    .forEach(([name, ref, localField]) => {
      schema.virtual(name, {
        ref, localField, foreignField: '_id', justOne: true,
      });
    });

  schema.plugin(softDelete);
  schema.plugin(toJson);

  return mongoose.model('policyInfo', schema);
};
