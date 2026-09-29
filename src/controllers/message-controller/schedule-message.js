const createHttpError = require('http-errors');
const { status } = require('http-status');

const { createScheduledMessage } = require('../../db-functions/scheduled-message');
const generateResponse = require('../../utils/generate-response');
const getMessage = require('../../utils/get-message');
const logger = require('../../utils/logger');
const { scheduleMessage } = require('../../utils/message-scheduler');

const DAY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const scheduleMessageController = async (req, res, next) => {
  try {
    const { body = {} } = req;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) throw createHttpError(status.BAD_REQUEST, getMessage('MESSAGE_REQUIRED'));
    if (!body.day) throw createHttpError(status.BAD_REQUEST, getMessage('DAY_REQUIRED'));
    if (!body.time) throw createHttpError(status.BAD_REQUEST, getMessage('TIME_REQUIRED'));

    // day and time are read as UTC; the round trip through toISOString rejects impossible dates such as 2026-02-30
    const day = String(body.day);
    const time = String(body.time);
    const scheduledDate = new Date(`${day}T${time}:00.000Z`);
    if (!DAY_REGEX.test(day) || !TIME_REGEX.test(time) || Number.isNaN(scheduledDate.getTime()) || !scheduledDate.toISOString().startsWith(day)) {
      throw createHttpError(status.BAD_REQUEST, getMessage('SCHEDULE_DATETIME_INVALID'));
    }
    if (scheduledDate.getTime() <= Date.now()) throw createHttpError(status.BAD_REQUEST, getMessage('SCHEDULE_DATETIME_PAST'));

    const scheduled = await createScheduledMessage({ message, scheduledDate });
    scheduleMessage({ id: scheduled.id, scheduledDate });
    return res.status(status.CREATED).json(generateResponse('MESSAGE_SCHEDULED', scheduled, status.CREATED));
  } catch (error) {
    logger.error(`ERROR FROM scheduleMessage ==> ${error}`);
    return next(error);
  }
};

module.exports = scheduleMessageController;
