const fs = require('node:fs/promises');

const request = require('supertest');

require('../helpers/setup-env');
const { models } = require('../../src/models');
const runUploadWorker = require('../../src/utils/run-upload-worker');
const buildApp = require('../helpers/build-app');
const { bearer, fakeUser } = require('../helpers/tokens');

jest.mock('../../src/models', () => require('../helpers/mock-models')); // eslint-disable-line n/global-require
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn() }));
jest.mock('../../src/utils/run-upload-worker', () => jest.fn());

const app = buildApp();
const admin = fakeUser({ id: 'a1', role: 'ADMIN' });
const stats = { totalRows: 2, recordsImported: 2, recordsSkipped: 0 };
const csv = Buffer.from('policy_number,email\nP1,a@x.com\n');

const upload = (token = bearer('a1')) => request(app).post('/policies/upload').set('Authorization', token);

describe('POST /policies/upload', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    models.user.findOne.mockResolvedValue(admin);
  });

  it('hands the stored temp file to the worker, returns its stats and leaves nothing behind', async () => {
    let seen;
    runUploadWorker.mockImplementation(async filePath => {
      seen = { filePath, content: await fs.readFile(filePath, 'utf8') };
      await fs.rm(filePath);
      return stats;
    });
    const res = await upload().attach('file', csv, 'policies.csv');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'Policies uploaded successfully', data: stats });
    expect(seen.filePath).toMatch(/\.csv$/);
    expect(seen.content).toBe(csv.toString());
  });

  it('accepts .xlsx files', async () => {
    runUploadWorker.mockImplementation(async filePath => {
      await fs.rm(filePath);
      return stats;
    });
    const res = await upload().attach('file', Buffer.from('x'), 'policies.XLSX');
    expect(res.status).toBe(200);
    expect(runUploadWorker.mock.calls[0][0]).toMatch(/\.xlsx$/);
  });

  it('returns 400 when no file is sent', async () => {
    const res = await upload().field('note', 'x');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('A .xlsx or .csv file is required in the "file" field');
    expect(runUploadWorker).not.toHaveBeenCalled();
  });

  it('returns 400 for an unsupported file type', async () => {
    const res = await upload().attach('file', Buffer.from('x'), 'policies.pdf');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Only .xlsx and .csv files are allowed');
    expect(runUploadWorker).not.toHaveBeenCalled();
  });

  it('returns 400 for a file in the wrong field', async () => {
    const res = await upload().attach('other', csv, 'policies.csv');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('File upload failed');
    expect(runUploadWorker).not.toHaveBeenCalled();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/policies/upload').attach('file', csv, 'policies.csv');
    expect(res.status).toBe(401);
    expect(runUploadWorker).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-ADMIN user before the worker runs', async () => {
    models.user.findOne.mockResolvedValue(fakeUser({ id: 'u2' }));
    const res = await upload(bearer('u2')).attach('file', csv, 'policies.csv');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('You do not have permission to perform this action');
    expect(runUploadWorker).not.toHaveBeenCalled();
  });

  it('returns 500 when the worker fails', async () => {
    runUploadWorker.mockRejectedValue(new Error('worker died'));
    const res = await upload().attach('file', csv, 'policies.csv');
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Something went wrong');
  });
});
