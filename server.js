const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

// Load config
const config = require('./src/utils/config');
const logger = require('./src/utils/logger');

// Initialize database
const { initializeDatabase } = require('./src/db/database');
initializeDatabase();

// Import services
const healthChecker = require('./src/services/healthChecker');

// Import routes
const deploymentsRouter = require('./src/routes/deployments');
const metricsRouter = require('./src/routes/metrics');
const rollbackRouter = require('./src/routes/rollback');
const jenkinsRouter = require('./src/routes/jenkins');

// Create Express app
const app = express();
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws) => {
  logger.info('WebSocket client connected');
  healthChecker.addClient(ws);

  ws.send(JSON.stringify({
    type: 'connected',
    data: { message: 'Connected to Canary Monitor' },
    timestamp: new Date().toISOString(),
  }));

  ws.on('close', () => {
    logger.info('WebSocket client disconnected');
  });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/deployments', deploymentsRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/rollback-logs', rollbackRouter);
app.use('/api/jenkins', jenkinsRouter);

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Dashboard config endpoint
app.get('/api/config', (req, res) => {
  res.json({
    canary: config.canary,
    jenkins: {
      url: config.jenkins.url,
      jobName: config.jenkins.jobName,
      // Don't expose credentials
    },
  });
});

// Catch-all to serve index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
server.listen(config.port, () => {
  logger.success(`
  ╔══════════════════════════════════════════════════╗
  ║   🐤 Canary Release Management System           ║
  ║                                                  ║
  ║   Dashboard: http://localhost:${config.port}             ║
  ║   API:       http://localhost:${config.port}/api          ║
  ║   WebSocket: ws://localhost:${config.port}/ws             ║
  ║                                                  ║
  ║   Environment: ${config.nodeEnv.padEnd(33)}║
  ╚══════════════════════════════════════════════════╝
  `);

  // Start health checker
  healthChecker.start();
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  healthChecker.stop();
  const metricsCollector = require('./src/services/metricsCollector');
  metricsCollector.stopAll();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server };
