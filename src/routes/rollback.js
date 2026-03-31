const express = require('express');
const router = express.Router();
const canaryManager = require('../services/canaryManager');

// GET /api/rollback-logs - Get rollback audit trail
router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = canaryManager.getRollbackLogs(limit);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/rollback-logs/:deploymentId - Get rollback logs for specific deployment
router.get('/:deploymentId', (req, res) => {
  try {
    const deploymentId = parseInt(req.params.deploymentId);
    const logs = canaryManager.getRollbackLogsByDeployment(deploymentId);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/audit - Get full audit trail
router.get('/audit/all', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const trail = canaryManager.getAuditTrail(limit);
    res.json({ success: true, data: trail });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
