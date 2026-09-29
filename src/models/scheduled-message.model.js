const crypto = require('node:crypto');

const softDelete = require('./plugins/soft-delete');
const toJson = require('./plugins/to-json');

module.exports = mongoose => {
  const schema = new mongoose.Schema({
    _id: { type: String, default: crypto.randomUUID },
    message: { type: String, required: true, trim: true },
    scheduledDate: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'executed', 'failed'], default: 'pending' },
  }, { timestamps: true, collection: 'scheduled_messages' });

  schema.index({ status: 1, scheduledDate: 1 });

  schema.plugin(softDelete);
  schema.plugin(toJson);

  return mongoose.model('scheduledMessage', schema);
};
