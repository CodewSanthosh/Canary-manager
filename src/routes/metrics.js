const express = require('express');
const router = express.Router();
const metricsCollector = require('../services/metricsCollector');

// GET /api/metrics/:deploymentId - Get metrics for a deployment
router.get('/:deploymentId', (req, res) => {
  try {
    const deploymentId = parseInt(req.params.deploymentId);
    const limit = parseInt(req.query.limit) || 60;
    const metrics = metricsCollector.getRecentMetrics(deploymentId, limit);
    res.json({ success: true, data: metrics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/metrics/:deploymentId/snapshot - Get latest metrics snapshot
router.get('/:deploymentId/snapshot', (req, res) => {
  try {
    const deploymentId = parseInt(req.params.deploymentId);
    const snapshot = metricsCollector.getLatestSnapshot(deploymentId);
    res.json({ success: true, data: snapshot });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/metrics/:deploymentId/:type - Get metrics by instance type
router.get('/:deploymentId/:type', (req, res) => {
  try {
    const deploymentId = parseInt(req.params.deploymentId);
    const type = req.params.type;
    const limit = parseInt(req.query.limit) || 30;

    if (!['stable', 'canary'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Type must be "stable" or "canary"' });
    }

    const metrics = metricsCollector.getMetricsByType(deploymentId, type, limit);
    res.json({ success: true, data: metrics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
