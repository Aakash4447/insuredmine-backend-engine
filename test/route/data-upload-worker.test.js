const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const workerThreads = require('node:worker_threads');

require('../helpers/setup-env');
const {
  models, mockQuery, connectDb, disconnectDb,
} = require('../../src/models');

jest.mock('../../src/models', () => require('../helpers/mock-models')); // eslint-disable-line n/global-require
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn() }));
jest.mock('node:worker_threads', () => ({ parentPort: { postMessage: jest.fn() }, workerData: {} }));

const header = [
  'agent', 'userType', 'policy_number', 'company_name', 'category_name', 'policy_start_date', 'policy_end_date',
  'account_name', 'email', 'gender', 'firstname', 'phone', 'address', 'state', 'zip', 'dob',
].join(',');
const csv = [
  header,
  'Bob,Active Client,P1,Acme,Auto,2024-01-01,2025-01-01,Acct,A@X.com,male,Ann,555,1 Main,TX,75001,1990-05-05',
  'Bob,Active Client,P2,Acme,Auto,2024-02-01,2025-02-01,Acct,a@x.com,male,Ann,555,1 Main,TX,75001,1990-05-05',
  'Bob,Active Client,P3,Acme,Auto,not-a-date,2025-01-01,Acct,a@x.com,male,Ann,555,1 Main,TX,75001,1990-05-05',
].join('\n');

const messages = () => workerThreads.parentPort.postMessage.mock.calls.map(([message]) => message);
const exists = filePath => fs.access(filePath).then(() => true, () => false);

// the worker starts on require and exports nothing, so wait for its final disconnectDb
const runWorker = async filePath => {
  workerThreads.workerData.filePath = filePath;
  jest.isolateModules(() => require('../../src/workers/data-upload-worker')); // eslint-disable-line n/global-require
  while (!disconnectDb.mock.calls.length) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => {
      setImmediate(resolve);
    });
  }
  return messages();
};

const writeTemp = async (name, content) => {
  const filePath = path.join(os.tmpdir(), `data-upload-worker-${Date.now()}-${name}`);
  await fs.writeFile(filePath, content);
  return filePath;
};

const mockDb = () => {
  const ok = { upsertedCount: 1, modifiedCount: 0 };
  ['agent', 'policyCarrier', 'policyCategory', 'policyHolder', 'policyInfo', 'userAccount'].forEach(name => {
    models[name].bulkWrite.mockResolvedValue(ok); // eslint-disable-line security/detect-object-injection
  });
  models.agent.find.mockReturnValue(mockQuery([{ _id: 'ag1', name: 'Bob' }]));
  models.policyHolder.find.mockReturnValue(mockQuery([{ _id: 'h1', email: 'a@x.com' }]));
  models.policyCategory.find.mockReturnValue(mockQuery([{ _id: 'c1', categoryName: 'Auto' }]));
  models.policyCarrier.find.mockReturnValue(mockQuery([{ _id: 'k1', companyName: 'Acme' }]));
  models.userAccount.find.mockReturnValue(mockQuery([{ _id: 'ac1', userId: 'h1', accountName: 'Acct' }]));
};

describe('data upload worker', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    delete workerThreads.workerData.filePath;
    mockDb();
  });

  it('imports a CSV: dedupes entities, links policies by resolved ids, reports skipped rows and cleans up', async () => {
    const filePath = await writeTemp('ok.csv', csv);
    const posted = await runWorker(filePath);

    const done = posted.find(message => message.type === 'done');
    expect(done.result).toMatchObject({
      totalRows: 3,
      recordsImported: 2,
      recordsSkipped: 1,
      skippedRowErrors: [{ row: 4, error: 'missing or invalid policyStartDate' }],
      policiesCreated: 1,
      agentsCreated: 1,
      usersCreated: 1,
      userAccountsCreated: 1,
      categoriesCreated: 1,
      carriersCreated: 1,
    });
    expect(posted.filter(message => message.type === 'progress').length).toBeGreaterThan(1);
    expect(connectDb).toHaveBeenCalled();

    const holderOps = models.policyHolder.bulkWrite.mock.calls[0][0];
    expect(holderOps).toHaveLength(1);
    expect(holderOps[0].updateOne.filter).toEqual({ email: 'a@x.com' });
    expect(holderOps[0].updateOne.update.$set).toMatchObject({ firstName: 'Ann', zipCode: '75001', userType: 'Active Client' });
    expect(holderOps[0].updateOne.upsert).toBe(true);
    expect(models.agent.bulkWrite.mock.calls[0][0][0].updateOne.filter).toEqual({ name: 'Bob' });
    expect(models.userAccount.bulkWrite.mock.calls[0][0][0].updateOne.filter).toEqual({ userId: 'h1', accountName: 'Acct' });

    const policyOps = models.policyInfo.bulkWrite.mock.calls[0][0];
    expect(policyOps.map(op => op.updateOne.filter)).toEqual([{ policyNumber: 'P1' }, { policyNumber: 'P2' }]);
    expect(policyOps[0].updateOne.update.$set).toMatchObject({ categoryId: 'c1', carrierId: 'k1', userId: 'h1' });
    expect(policyOps[0].updateOne.update.$set.policyStartDate).toEqual(new Date('2024-01-01'));
    expect(policyOps[0].updateOne.update.$setOnInsert._id).toEqual(expect.any(String));

    expect(await exists(filePath)).toBe(false);
    expect(disconnectDb).toHaveBeenCalled();
  });

  it('writes nothing when every row is invalid', async () => {
    const filePath = await writeTemp('empty.csv', `${header}\n,,,,,,,,,,,,,,,`);
    const posted = await runWorker(filePath);
    expect(posted.find(message => message.type === 'done').result).toMatchObject({ totalRows: 1, recordsImported: 0, recordsSkipped: 1 });
    expect(models.policyInfo.bulkWrite).not.toHaveBeenCalled();
    expect(await exists(filePath)).toBe(false);
  });

  it('treats validation errors that bulkWrite reports on the result as failures', async () => {
    models.agent.bulkWrite.mockResolvedValue({ upsertedCount: 0, modifiedCount: 0, mongoose: { validationErrors: [new Error('cast failed')] } });
    const filePath = await writeTemp('invalid.csv', csv);
    const posted = await runWorker(filePath);
    expect(posted.find(message => message.type === 'error')).toEqual({ type: 'error', message: 'cast failed' });
    expect(models.policyInfo.bulkWrite).not.toHaveBeenCalled();
  });

  it('posts an error and still removes the file when the database fails', async () => {
    models.policyInfo.bulkWrite.mockRejectedValue(new Error('db down'));
    const filePath = await writeTemp('fail.csv', csv);
    const posted = await runWorker(filePath);
    expect(posted.find(message => message.type === 'error')).toEqual({ type: 'error', message: 'db down' });
    expect(posted.some(message => message.type === 'done')).toBe(false);
    expect(await exists(filePath)).toBe(false);
    expect(disconnectDb).toHaveBeenCalled();
  });
});
