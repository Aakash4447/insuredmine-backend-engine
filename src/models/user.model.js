const crypto = require('node:crypto');

const softDelete = require('./plugins/soft-delete');
const toJson = require('./plugins/to-json');

module.exports = mongoose => {
  const userSchema = new mongoose.Schema({
    _id: { type: String, default: crypto.randomUUID },
    name: { type: String, required: true, trim: true },
    email: {
      type: String, required: true, unique: true, lowercase: true, trim: true,
    },
    password: { type: String, required: true, select: false },
    roles: { type: [String], enum: ['ADMIN', 'USER'], default: ['USER'] },
  }, { timestamps: true, collection: 'users' });

  userSchema.plugin(softDelete);
  userSchema.plugin(toJson);

  return mongoose.model('user', userSchema);
};
