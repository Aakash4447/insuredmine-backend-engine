const express = require('express');

const messageController = require('../controllers/message-controller');
const { auth } = require('../middlewares');

const router = express.Router();

router.post('/schedule', auth(), messageController.scheduleMessage);

module.exports = router;
