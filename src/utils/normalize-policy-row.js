const ALIASES = {
  agent: ['agent', 'agentname'],
  userType: ['usertype'],
  policyNumber: ['policynumber'],
  companyName: ['companyname', 'carrier', 'carriername'],
  categoryName: ['categoryname', 'category', 'lob'],
  policyStartDate: ['policystartdate', 'startdate'],
  policyEndDate: ['policyenddate', 'enddate'],
  accountName: ['accountname'],
  email: ['email'],
  gender: ['gender'],
  firstName: ['firstname'],
  phoneNumber: ['phone', 'phonenumber'],
  address: ['address'],
  state: ['state'],
  zipCode: ['zip', 'zipcode'],
  dob: ['dob'],
};

const aliasMap = new Map(Object.entries(ALIASES).flatMap(([field, names]) => names.map(name => [name, field])));

const toText = value => (value === null || value === undefined ? '' : String(value).trim());

const toDate = value => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// maps a raw row (any header casing/underscores) to the canonical fields; returns { row } or { error }
const normalizePolicyRow = raw => {
  const fields = Object.fromEntries(Object.entries(raw)
    .map(([header, value]) => [aliasMap.get(header.toLowerCase().replace(/[^a-z0-9]/g, '')), value])
    .filter(([field]) => field));

  const row = {
    agent: toText(fields.agent),
    userType: toText(fields.userType),
    policyNumber: toText(fields.policyNumber),
    companyName: toText(fields.companyName),
    categoryName: toText(fields.categoryName),
    policyStartDate: toDate(fields.policyStartDate),
    policyEndDate: toDate(fields.policyEndDate),
    accountName: toText(fields.accountName),
    email: toText(fields.email).toLowerCase(),
    gender: toText(fields.gender),
    firstName: toText(fields.firstName),
    phoneNumber: toText(fields.phoneNumber),
    address: toText(fields.address),
    state: toText(fields.state),
    zipCode: toText(fields.zipCode),
    dob: toDate(fields.dob) || undefined,
  };

  const required = ['policyNumber', 'companyName', 'categoryName', 'policyStartDate', 'policyEndDate', 'email', 'firstName'];
  const missing = required.filter(field => !row[field]); // eslint-disable-line security/detect-object-injection
  if (missing.length) return { error: `missing or invalid ${missing.join(', ')}` };
  return { row };
};

module.exports = normalizePolicyRow;
