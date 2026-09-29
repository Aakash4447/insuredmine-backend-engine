const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const ExcelJS = require('exceljs');

const parseUploadFile = require('../../src/utils/parse-upload-file');

const tempPath = name => path.join(os.tmpdir(), `parse-upload-file-${Date.now()}-${Math.random()}-${name}`);

describe('parseUploadFile', () => {
  const files = [];
  afterAll(() => Promise.all(files.map(file => fs.rm(file, { force: true }))));

  it('parses a CSV into row objects keyed by header', async () => {
    const filePath = tempPath('a.csv');
    files.push(filePath);
    await fs.writeFile(filePath, 'policy_number,email\nP1,a@x.com\nP2,b@x.com\n');
    await expect(parseUploadFile(filePath)).resolves.toEqual([
      { policy_number: 'P1', email: 'a@x.com' },
      { policy_number: 'P2', email: 'b@x.com' },
    ]);
  });

  it('parses the first sheet of an XLSX, keeping dates and flattening formula and rich text cells', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('policies');
    sheet.addRow(['policy_number', 'dob', 'email', 'firstname']);
    sheet.addRow(['P1', new Date('1990-05-05'), { formula: 'A1', result: 'a@x.com' }, { richText: [{ text: 'An' }, { text: 'n' }] }]);
    const filePath = tempPath('a.xlsx');
    files.push(filePath);
    await workbook.xlsx.writeFile(filePath);

    await expect(parseUploadFile(filePath)).resolves.toEqual([
      {
        policy_number: 'P1', dob: new Date('1990-05-05'), email: 'a@x.com', firstname: 'Ann',
      },
    ]);
  });
});
