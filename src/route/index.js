const express = require('express');

const { getVersion } = require('../controllers/version-controller');

const messageRoutes = require('./message.routes');
const policyRoutes = require('./policy.routes');
const userRoutes = require('./user.routes');

const router = express.Router();

router.get('/version', getVersion);
router.use('/messages', messageRoutes);
router.use('/policies', policyRoutes);
router.use('/user', userRoutes);

module.exports = router;
