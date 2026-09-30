const express = require('express');

const policyController = require('../controllers/policy-controller');
const { auth, uploadPolicyFile } = require('../middlewares');

const router = express.Router();

router.post('/upload', auth(['ADMIN']), uploadPolicyFile, policyController.uploadPolicies);
router.get('/search', auth(), policyController.searchPolicies);
router.get('/aggregate-by-user', auth(), policyController.aggregatePoliciesByUser);

module.exports = router;
