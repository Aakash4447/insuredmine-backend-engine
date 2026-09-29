const crypto = require('node:crypto');

const softDelete = require('./plugins/soft-delete');
const toJson = require('./plugins/to-json');

module.exports = mongoose => {
  const schema = new mongoose.Schema({
    _id: { type: String, default: crypto.randomUUID },
    name: { type: String, required: true, trim: true },
  }, { timestamps: true, collection: 'agents' });

  schema.plugin(softDelete);
  schema.plugin(toJson);

  return mongoose.model('agent', schema);
};
