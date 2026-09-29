const events = require('node:events');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');

const csvParser = require('csv-parser');
const ExcelJS = require('exceljs');

// exceljs cells can be rich objects (formula, hyperlink, rich text); reduce them to a primitive
const cellValue = value => {
  if (value === null || value === undefined || value instanceof Date || typeof value !== 'object') return value;
  if (value.richText) return value.richText.map(part => part.text).join('');
  if (value.result !== undefined) return cellValue(value.result);
  if (value.text !== undefined) return value.text;
  return String(value);
};

const parseCsv = async filePath => {
  const rows = [];
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const stream = fs.createReadStream(filePath).pipe(csvParser());
  stream.on('data', row => rows.push(row));
  await events.once(stream, 'end');
  return rows;
};

const parseXlsx = async filePath => {
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await workbook.xlsx.load(await fsPromises.readFile(filePath));
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headers = [];
  sheet.getRow(1).eachCell((cell, column) => headers.push([column, String(cellValue(cell.value))]));

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    rows.push(Object.fromEntries(headers.map(([column, header]) => [header, cellValue(row.getCell(column).value)])));
  });
  return rows;
};

// resolves to an array of raw row objects keyed by the header names of the first line / sheet
const parseUploadFile = filePath => (path.extname(filePath).toLowerCase() === '.csv' ? parseCsv(filePath) : parseXlsx(filePath));

module.exports = parseUploadFile;
