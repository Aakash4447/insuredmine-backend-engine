const messages = {
  // common
  INTERNAL_SERVER_ERROR: 'Something went wrong',
  ROUTE_NOT_FOUND: 'Route not found',

  // auth
  TOKEN_REQUIRED: 'Authorization token is required',
  TOKEN_INVALID: 'Authorization token is invalid or expired',

  // input
  NAME_REQUIRED: 'Name is required',
  EMAIL_REQUIRED: 'Email is required',
  EMAIL_INVALID: 'Email is invalid',
  PASSWORD_REQUIRED: 'Password is required',

  // user module
  USER_NOT_FOUND: 'User not found',
  EMAIL_ALREADY_EXISTS: 'Email already exists',
  INVALID_CREDENTIALS: 'Invalid email or password',
  UNAUTHORIZED: 'You do not have permission to perform this action',
  USER_REGISTERED: 'User registered successfully',
  LOGIN_SUCCESS: 'Logged in successfully',
  USER_FETCHED: 'User fetched successfully',
  USERS_FETCHED: 'Users fetched successfully',

  // policy module
  FILE_REQUIRED: 'A .xlsx or .csv file is required in the "file" field',
  FILE_TYPE_INVALID: 'Only .xlsx and .csv files are allowed',
  FILE_TOO_LARGE: 'File is too large',
  FILE_UPLOAD_FAILED: 'File upload failed',
  POLICIES_UPLOADED: 'Policies uploaded successfully',
  USERNAME_REQUIRED: 'Username is required',
  PAGINATION_INVALID: 'page and limit must be positive integers and limit must not exceed 100',
  POLICIES_FETCHED: 'Policies fetched successfully',
  POLICIES_AGGREGATED: 'Policies aggregated by user successfully',

  // message module
  MESSAGE_REQUIRED: 'Message is required',
  DAY_REQUIRED: 'Day is required',
  TIME_REQUIRED: 'Time is required',
  SCHEDULE_DATETIME_INVALID: 'Day must be a valid YYYY-MM-DD date and time a valid HH:mm time',
  SCHEDULE_DATETIME_PAST: 'Scheduled date and time must be in the future',
  MESSAGE_SCHEDULED: 'Message scheduled successfully',

  // version
  VERSION_FETCHED: 'Version fetched successfully',
};

// eslint-disable-next-line security/detect-object-injection
const getMessage = key => messages[key] || key;

module.exports = getMessage;
