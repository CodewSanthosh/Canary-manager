const express = require('express');
const router = express.Router();
const jenkinsService = require('../services/jenkinsService');
const logger = require('../utils/logger');

// POST /api/jenkins/trigger - Trigger a Jenkins build
router.post('/trigger', async (req, res) => {
  try {
    const params = req.body.params || {};
    const result = await jenkinsService.triggerBuild(params);
    res.json({ success: result.success, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/jenkins/status - Get last build status
router.get('/status', async (req, res) => {
  try {
    const result = await jenkinsService.getLastBuildStatus();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/jenkins/server - Get Jenkins server status
router.get('/server', async (req, res) => {
  try {
    const status = await jenkinsService.getServerStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/jenkins/webhook - Receive Jenkins build notifications
router.post('/webhook', (req, res) => {
  try {
    const { build } = req.body;
    logger.info(`Jenkins webhook received: Build #${build?.number} — ${build?.status}`);

    // Process webhook notification
    if (build?.status === 'SUCCESS') {
      logger.success(`Jenkins build #${build.number} completed successfully`);
    } else if (build?.status === 'FAILURE') {
      logger.error(`Jenkins build #${build.number} failed`);
    }

    res.json({ success: true, message: 'Webhook received' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
