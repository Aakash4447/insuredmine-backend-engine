const EventEmitter = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

const logger = require('../../src/utils/logger');
const runUploadWorker = require('../../src/utils/run-upload-worker');

jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn() }));
jest.mock('node:worker_threads', () => ({ Worker: jest.fn() }));

const tempFile = async () => {
  const filePath = path.join(os.tmpdir(), `run-upload-worker-${Date.now()}-${Math.random()}.csv`);
  await fs.writeFile(filePath, 'x');
  return filePath;
};
const exists = filePath => fs.access(filePath).then(() => true, () => false);

// the fake worker replays `events` (name, ...args) on the next tick
const fakeWorker = events => Worker.mockImplementation(() => {
  const emitter = new EventEmitter();
  setImmediate(() => events.forEach(([name, ...args]) => emitter.emit(name, ...args)));
  return emitter;
});

describe('runUploadWorker', () => {
  beforeEach(() => jest.resetAllMocks());

  it('passes the file path as workerData, logs progress and resolves with the result', async () => {
    const filePath = await tempFile();
    fakeWorker([
      ['message', { type: 'progress', message: 'parsing file' }],
      ['message', { type: 'done', result: { recordsImported: 3 } }],
      ['exit', 0],
    ]);
    await expect(runUploadWorker(filePath)).resolves.toEqual({ recordsImported: 3 });
    expect(Worker).toHaveBeenCalledWith(expect.stringMatching(/data-upload-worker\.js$/), { workerData: { filePath } });
    expect(logger.info).toHaveBeenCalledWith('dataUploadWorker: parsing file');
    expect(await exists(filePath)).toBe(false);
  });

  it('rejects with the message the worker reports and removes the file', async () => {
    const filePath = await tempFile();
    fakeWorker([['message', { type: 'error', message: 'bad sheet' }], ['exit', 0]]);
    await expect(runUploadWorker(filePath)).rejects.toThrow('bad sheet');
    expect(await exists(filePath)).toBe(false);
  });

  it('rejects when the worker throws', async () => {
    const filePath = await tempFile();
    fakeWorker([['error', new Error('boom')], ['exit', 1]]);
    await expect(runUploadWorker(filePath)).rejects.toThrow('boom');
    expect(await exists(filePath)).toBe(false);
  });

  it('rejects when the worker exits without a result', async () => {
    const filePath = await tempFile();
    fakeWorker([['exit', 1]]);
    await expect(runUploadWorker(filePath)).rejects.toThrow('Upload worker stopped with exit code 1');
    expect(await exists(filePath)).toBe(false);
  });
});
