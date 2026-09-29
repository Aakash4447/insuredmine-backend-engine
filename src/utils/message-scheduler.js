const { findPendingMessages, updatePendingMessageStatus } = require('../db-functions/scheduled-message');

const logger = require('./logger');

// setTimeout overflows (and fires immediately) above this many ms, so far-away messages are re-armed in steps
const MAX_DELAY_MS = 2 ** 31 - 1;

const executeMessage = async id => {
  try {
    const message = await updatePendingMessageStatus(id, 'executed');
    if (message) logger.info(`Scheduled message ${id} executed at ${new Date().toISOString()}: ${message.message}`);
  } catch (error) {
    logger.error(`ERROR FROM executeScheduledMessage ==> ${error}`);
    try {
      await updatePendingMessageStatus(id, 'failed');
    } catch (statusError) {
      logger.error(`ERROR FROM executeScheduledMessage (marking failed) ==> ${statusError}`);
    }
  }
};

// runs the message at its scheduled time (immediately when already due) with a setTimeout
const scheduleMessage = ({ id, scheduledDate }) => {
  const target = new Date(scheduledDate).getTime();
  const timer = setTimeout(() => {
    if (target - Date.now() > 0) scheduleMessage({ id, scheduledDate });
    else executeMessage(id);
  }, Math.min(Math.max(target - Date.now(), 0), MAX_DELAY_MS));
  timer.unref();
};

// timers live in memory, so on boot pick up every pending message again (overdue ones run right away)
const loadPendingMessages = async () => {
  const pending = await findPendingMessages();
  pending.forEach(message => scheduleMessage({ id: message._id, scheduledDate: message.scheduledDate }));
  return pending.length;
};

module.exports = { loadPendingMessages, scheduleMessage };
