const express = require('express');
const router = express.Router();
const canaryManager = require('../services/canaryManager');
const metricsCollector = require('../services/metricsCollector');

// GET /api/deployments - List all deployments
router.get('/', (req, res) => {
  try {
    const deployments = canaryManager.getAllDeployments();
    res.json({ success: true, data: deployments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/deployments/active - List active deployments
router.get('/active', (req, res) => {
  try {
    const deployments = canaryManager.getActiveDeployments();
    res.json({ success: true, data: deployments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/deployments/:id - Get deployment by ID
router.get('/:id', (req, res) => {
  try {
    const deployment = canaryManager.getDeployment(parseInt(req.params.id));
    if (!deployment) {
      return res.status(404).json({ success: false, error: 'Deployment not found' });
    }
    const trafficSplit = canaryManager.getTrafficSplit(deployment.id);
    res.json({ success: true, data: { ...deployment, trafficSplit } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/deployments - Create new canary deployment
router.post('/', (req, res) => {
  try {
    const { name, stableVersion, canaryVersion, trafficPercent, description } = req.body;

    if (!name || !stableVersion || !canaryVersion) {
      return res.status(400).json({
        success: false,
        error: 'name, stableVersion, and canaryVersion are required',
      });
    }

    const deployment = canaryManager.createDeployment({
      name,
      stableVersion,
      canaryVersion,
      trafficPercent: trafficPercent || 10,
      description,
      createdBy: 'dashboard',
    });

    // Start metrics collection for this deployment
    metricsCollector.startCollection(deployment.id);

    res.status(201).json({ success: true, data: deployment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/deployments/:id/promote - Promote canary (step or full)
router.post('/:id/promote', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { full } = req.body;

    let deployment;
    if (full) {
      deployment = canaryManager.promoteCanary(id);
      metricsCollector.stopCollection(id);
    } else {
      deployment = canaryManager.stepPromote(id);
    }

    res.json({ success: true, data: deployment });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/deployments/:id/rollback - Manual rollback
router.post('/:id/rollback', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;

    const deployment = canaryManager.rollbackCanary(id, {
      reason: reason || 'Manual rollback from dashboard',
      triggerType: 'manual',
      rolledBackBy: 'dashboard',
    });

    metricsCollector.stopCollection(id);

    res.json({ success: true, data: deployment });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/deployments/:id/simulate-failure - Enable failure simulation
router.post('/:id/simulate-failure', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { enable } = req.body;

    if (enable) {
      metricsCollector.enableFailureMode(id);
    } else {
      metricsCollector.disableFailureMode(id);
    }

    res.json({ success: true, message: `Failure simulation ${enable ? 'enabled' : 'disabled'}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
