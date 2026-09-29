const normalizePolicyRow = require('../../src/utils/normalize-policy-row');

const valid = {
  Agent: ' Bob ',
  policy_number: 'P1',
  'Company Name': 'Acme',
  LOB: 'Auto',
  policy_start_date: '2024-01-01',
  policy_end_date: new Date('2025-01-01'),
  email: ' A@X.com ',
  firstname: 'Ann',
  zip: 75001,
  dob: 'garbage',
  ignored: 'x',
};

describe('normalizePolicyRow', () => {
  it('maps header aliases to canonical fields, trims, lowercases the email and parses dates', () => {
    const { row, error } = normalizePolicyRow(valid);
    expect(error).toBeUndefined();
    expect(row).toMatchObject({
      agent: 'Bob',
      policyNumber: 'P1',
      companyName: 'Acme',
      categoryName: 'Auto',
      policyStartDate: new Date('2024-01-01'),
      policyEndDate: new Date('2025-01-01'),
      email: 'a@x.com',
      firstName: 'Ann',
      zipCode: '75001',
      accountName: '',
    });
    expect(row.dob).toBeUndefined();
  });

  it.each([
    ['policy_number', 'policyNumber'],
    ['email', 'email'],
    ['policy_end_date', 'policyEndDate'],
  ])('reports a row missing %s', (header, field) => {
    const { row, error } = normalizePolicyRow({ ...valid, [header]: '' });
    expect(row).toBeUndefined();
    expect(error).toBe(`missing or invalid ${field}`);
  });
});
