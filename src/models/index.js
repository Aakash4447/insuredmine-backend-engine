const mongoose = require('mongoose');

const agent = require('./agent.model');
const policyCarrier = require('./policy-carrier.model');
const policyCategory = require('./policy-category.model');
const policyHolder = require('./policy-holder.model');
const policyInfo = require('./policy-info.model');
const scheduledMessage = require('./scheduled-message.model');
const userAccount = require('./user-account.model');
const user = require('./user.model');

const models = {
  agent: agent(mongoose),
  policyCarrier: policyCarrier(mongoose),
  policyCategory: policyCategory(mongoose),
  policyHolder: policyHolder(mongoose),
  policyInfo: policyInfo(mongoose),
  scheduledMessage: scheduledMessage(mongoose),
  user: user(mongoose),
  userAccount: userAccount(mongoose),
};

const connectDb = () => mongoose.connect(process.env.MONGODB_URI);

const disconnectDb = () => mongoose.disconnect();

module.exports = {
  mongoose, models, connectDb, disconnectDb,
};
