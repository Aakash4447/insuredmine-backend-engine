const crypto = require('node:crypto');

const softDelete = require('./plugins/soft-delete');
const toJson = require('./plugins/to-json');

module.exports = mongoose => {
  const schema = new mongoose.Schema({
    _id: { type: String, default: crypto.randomUUID },
    companyName: {
      type: String, required: true, unique: true, trim: true,
    },
  }, { timestamps: true, collection: 'policy_carriers' });

  schema.plugin(softDelete);
  schema.plugin(toJson);

  return mongoose.model('policyCarrier', schema);
};
