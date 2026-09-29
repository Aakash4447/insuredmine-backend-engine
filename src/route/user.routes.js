const express = require('express');

const userController = require('../controllers/user-controller');
const { auth } = require('../middlewares');

const router = express.Router();

router.post('/register', userController.register);
router.post('/login', userController.login);
router.get('/me', auth, userController.getMe);
router.get('/list', auth, userController.listUsers);

module.exports = router;
