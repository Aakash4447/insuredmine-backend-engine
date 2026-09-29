require('../helpers/setup-env');
const { models, mockQuery } = require('../../src/models');
const logger = require('../../src/utils/logger');
const { loadPendingMessages, scheduleMessage } = require('../../src/utils/message-scheduler');

jest.mock('../../src/models', () => require('../helpers/mock-models')); // eslint-disable-line n/global-require
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn() }));

const NOW = new Date('2030-01-01T00:00:00.000Z');
const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve(); // eslint-disable-line no-await-in-loop
};

describe('message scheduler', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    models.scheduledMessage.findOneAndUpdate.mockResolvedValue({ message: 'Hello' });
  });

  afterEach(() => jest.useRealTimers());

  it('marks the message executed and logs it when its time arrives, not before', async () => {
    scheduleMessage({ id: 'm1', scheduledDate: new Date(NOW.getTime() + 60000) });
    jest.advanceTimersByTime(59999);
    await flush();
    expect(models.scheduledMessage.findOneAndUpdate).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await flush();
    expect(models.scheduledMessage.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'm1', status: 'pending' },
      { status: 'executed' },
      { returnDocument: 'after' },
    );
    expect(logger.info).toHaveBeenCalledWith('Scheduled message m1 executed at 2030-01-01T00:01:00.000Z: Hello');
  });

  it('runs an overdue message right away', async () => {
    scheduleMessage({ id: 'm2', scheduledDate: new Date(NOW.getTime() - 1000) });
    jest.advanceTimersByTime(0);
    await flush();
    expect(models.scheduledMessage.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('re-arms messages further away than the setTimeout limit instead of firing early', async () => {
    const days = 40;
    scheduleMessage({ id: 'm3', scheduledDate: new Date(NOW.getTime() + days * 86400000) });
    jest.advanceTimersByTime(2 ** 31 - 1);
    await flush();
    expect(models.scheduledMessage.findOneAndUpdate).not.toHaveBeenCalled();

    jest.advanceTimersByTime(days * 86400000 - (2 ** 31 - 1));
    await flush();
    expect(models.scheduledMessage.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('logs nothing when the message was already executed elsewhere', async () => {
    models.scheduledMessage.findOneAndUpdate.mockResolvedValue(null);
    scheduleMessage({ id: 'm4', scheduledDate: NOW });
    jest.advanceTimersByTime(0);
    await flush();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('marks the message failed when executing it throws', async () => {
    models.scheduledMessage.findOneAndUpdate.mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce({});
    scheduleMessage({ id: 'm5', scheduledDate: NOW });
    jest.advanceTimersByTime(0);
    await flush();
    expect(models.scheduledMessage.findOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: 'm5', status: 'pending' },
      { status: 'failed' },
      { returnDocument: 'after' },
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it('does not throw when marking the message failed also fails', async () => {
    models.scheduledMessage.findOneAndUpdate.mockRejectedValue(new Error('db down'));
    scheduleMessage({ id: 'm6', scheduledDate: NOW });
    jest.advanceTimersByTime(0);
    await flush();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('marking failed'));
  });

  it('loadPendingMessages re-arms every pending message and returns their count', async () => {
    const query = mockQuery([
      { _id: 'a', scheduledDate: new Date(NOW.getTime() - 5000) },
      { _id: 'b', scheduledDate: new Date(NOW.getTime() + 5000) },
    ]);
    models.scheduledMessage.find.mockReturnValue(query);
    await expect(loadPendingMessages()).resolves.toBe(2);
    expect(models.scheduledMessage.find).toHaveBeenCalledWith({ status: 'pending', deletedAt: null });

    jest.advanceTimersByTime(0);
    await flush();
    expect(models.scheduledMessage.findOneAndUpdate).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(5000);
    await flush();
    expect(models.scheduledMessage.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });
});
