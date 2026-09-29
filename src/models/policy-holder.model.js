const crypto = require('node:crypto');

const softDelete = require('./plugins/soft-delete');
const toJson = require('./plugins/to-json');

module.exports = mongoose => {
  const schema = new mongoose.Schema({
    _id: { type: String, default: crypto.randomUUID },
    firstName: { type: String, required: true, trim: true },
    dob: { type: Date },
    address: { type: String },
    phoneNumber: { type: String },
    state: { type: String },
    zipCode: { type: String },
    email: {
      type: String, required: true, unique: true, lowercase: true, trim: true,
    },
    gender: { type: String },
    userType: { type: String },
  }, { timestamps: true, collection: 'policy_holders' });

  schema.index({ firstName: 'text' });

  schema.plugin(softDelete);
  schema.plugin(toJson);

  return mongoose.model('policyHolder', schema);
};
