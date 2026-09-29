const jwt = require('jsonwebtoken');

const bearer = (userId = 'u1', options = {}) => `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET, options)}`;

const fakeUser = (overrides = {}) => ({
  id: 'u1', name: 'Test', email: 'test@example.com', role: 'USER', ...overrides,
});

module.exports = { bearer, fakeUser };
