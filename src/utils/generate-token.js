const jwt = require('jsonwebtoken');

const generateToken = payload => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_LIFE_TIME });

const generateRefreshToken = payload => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_REFRESH_TOKEN_LIFE_TIME });

const decodeToken = token => jwt.verify(token, process.env.JWT_SECRET);

module.exports = { generateToken, generateRefreshToken, decodeToken };
