const request = require('supertest');

require('../helpers/setup-env');
const { models } = require('../../src/models');
const { scheduleMessage } = require('../../src/utils/message-scheduler');
const buildApp = require('../helpers/build-app');
const { bearer, fakeUser } = require('../helpers/tokens');

jest.mock('../../src/models', () => require('../helpers/mock-models')); // eslint-disable-line n/global-require
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn() }));
jest.mock('../../src/utils/message-scheduler', () => ({ scheduleMessage: jest.fn(), loadPendingMessages: jest.fn() }));

const app = buildApp();
const valid = { message: ' Hello ', day: '2099-03-04', time: '09:30' };
const stored = {
  id: 'm1', message: 'Hello', scheduledDate: '2099-03-04T09:30:00.000Z', status: 'pending',
};

const schedule = (body = valid, token = bearer('u1')) => request(app).post('/messages/schedule').set('Authorization', token).send(body);

describe('POST /messages/schedule', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    models.user.findOne.mockResolvedValue(fakeUser());
    models.scheduledMessage.create.mockResolvedValue({ toJSON: () => stored });
  });

  it('stores the message with the parsed UTC date and arms the timer', async () => {
    const res = await schedule();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      success: true, statusCode: 201, message: 'Message scheduled successfully', data: stored,
    });
    expect(models.scheduledMessage.create).toHaveBeenCalledWith({ message: 'Hello', scheduledDate: new Date('2099-03-04T09:30:00.000Z') });
    expect(scheduleMessage).toHaveBeenCalledWith({ id: 'm1', scheduledDate: new Date('2099-03-04T09:30:00.000Z') });
  });

  it.each([
    [{ ...valid, message: undefined }, 'Message is required'],
    [{ ...valid, message: '   ' }, 'Message is required'],
    [{ ...valid, message: { $ne: 1 } }, 'Message is required'],
    [{ ...valid, day: undefined }, 'Day is required'],
    [{ ...valid, time: undefined }, 'Time is required'],
  ])('returns 400 for missing input %#', async (body, message) => {
    const res = await schedule(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
    expect(models.scheduledMessage.create).not.toHaveBeenCalled();
  });

  it.each([
    ['2099-3-4', '09:30'],
    ['04-03-2099', '09:30'],
    ['2099-02-30', '09:30'],
    ['2099-13-01', '09:30'],
    ['2099-03-04', '9:30'],
    ['2099-03-04', '24:00'],
    ['2099-03-04', '09:60'],
    ['2099-03-04', '09:30:00'],
    ['tomorrow', 'noon'],
  ])('returns 400 for an invalid day/time (%s %s)', async (day, time) => {
    const res = await schedule({ ...valid, day, time });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Day must be a valid YYYY-MM-DD date and time a valid HH:mm time');
    expect(models.scheduledMessage.create).not.toHaveBeenCalled();
  });

  it('returns 400 when the date and time are in the past', async () => {
    const res = await schedule({ ...valid, day: '2000-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Scheduled date and time must be in the future');
    expect(models.scheduledMessage.create).not.toHaveBeenCalled();
    expect(scheduleMessage).not.toHaveBeenCalled();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/messages/schedule').send(valid);
    expect(res.status).toBe(401);
    expect(models.scheduledMessage.create).not.toHaveBeenCalled();
  });

  it('returns 500 and does not arm a timer when the insert fails', async () => {
    models.scheduledMessage.create.mockRejectedValue(new Error('db down'));
    const res = await schedule();
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Something went wrong');
    expect(scheduleMessage).not.toHaveBeenCalled();
  });
});
