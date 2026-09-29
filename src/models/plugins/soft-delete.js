const queryHooks = ['find', 'findOne', 'findOneAndUpdate', 'countDocuments', 'updateOne', 'updateMany'];

const softDelete = schema => {
  schema.add({ deletedAt: { type: Date, default: null } });

  queryHooks.forEach(hook => {
    schema.pre(hook, function skipDeleted() {
      if (this.getOptions().withDeleted) return;
      if (this.getFilter().deletedAt === undefined) this.where({ deletedAt: null });
    });
  });

  schema.pre('aggregate', function skipDeletedAggregate() {
    if (this.options.withDeleted) return;
    this.pipeline().unshift({ $match: { deletedAt: null } });
  });

  schema.methods.softDelete = function softDeleteDoc() {
    this.deletedAt = new Date();
    return this.save();
  };
};

module.exports = softDelete;
