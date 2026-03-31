const config = require('../utils/config');
const logger = require('../utils/logger');
const canaryManager = require('./canaryManager');
const metricsCollector = require('./metricsCollector');

class HealthChecker {
  constructor() {
    this.checkInterval = null;
    this.wsClients = new Set();
    this.isRunning = false;
  }

  /**
   * Register a WebSocket client for real-time updates
   */
  addClient(ws) {
    this.wsClients.add(ws);
    ws.on('close', () => this.wsClients.delete(ws));
  }

  /**
   * Broadcast data to all connected WebSocket clients
   */
  broadcast(eventType, data) {
    const message = JSON.stringify({ type: eventType, data, timestamp: new Date().toISOString() });
    for (const ws of this.wsClients) {
      try {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(message);
        }
      } catch (err) {
        this.wsClients.delete(ws);
      }
    }
  }

  /**
   * Check health of a single deployment
   */
  checkDeploymentHealth(deployment) {
    const snapshot = metricsCollector.getLatestSnapshot(deployment.id);

    if (!snapshot.canary || !snapshot.stable) return null;

    const canary = snapshot.canary;
    const stable = snapshot.stable;
    const thresholds = config.canary;

    const healthReport = {
      deploymentId: deployment.id,
      name: deployment.name,
      status: deployment.status,
      trafficPercent: deployment.traffic_percent,
      stable: {
        errorRate: stable.error_rate,
        latency: stable.latency_ms,
        cpu: stable.cpu_percent,
        memory: stable.memory_percent,
      },
      canary: {
        errorRate: canary.error_rate,
        latency: canary.latency_ms,
        cpu: canary.cpu_percent,
        memory: canary.memory_percent,
      },
      thresholds: {
        errorRate: thresholds.errorRateThreshold,
        latency: thresholds.latencyThresholdMs,
      },
      isHealthy: true,
      issues: [],
    };

    // Check error rate threshold
    if (canary.error_rate > thresholds.errorRateThreshold) {
      healthReport.isHealthy = false;
      healthReport.issues.push({
        type: 'ERROR_RATE',
        message: `Canary error rate ${canary.error_rate}% exceeds threshold ${thresholds.errorRateThreshold}%`,
        severity: 'critical',
      });
    }

    // Check latency threshold
    if (canary.latency_ms > thresholds.latencyThresholdMs) {
      healthReport.isHealthy = false;
      healthReport.issues.push({
        type: 'LATENCY',
        message: `Canary latency ${canary.latency_ms}ms exceeds threshold ${thresholds.latencyThresholdMs}ms`,
        severity: 'critical',
      });
    }

    // Check if canary is significantly worse than stable
    if (canary.error_rate > stable.error_rate * 5) {
      healthReport.issues.push({
        type: 'ERROR_RATE_SPIKE',
        message: `Canary error rate is ${(canary.error_rate / stable.error_rate).toFixed(1)}x higher than stable`,
        severity: 'warning',
      });
    }

    if (canary.latency_ms > stable.latency_ms * 3) {
      healthReport.issues.push({
        type: 'LATENCY_SPIKE',
        message: `Canary latency is ${(canary.latency_ms / stable.latency_ms).toFixed(1)}x higher than stable`,
        severity: 'warning',
      });
    }

    return healthReport;
  }

  /**
   * Run health check on all active deployments
   */
  runHealthCheck() {
    const activeDeployments = canaryManager.getActiveDeployments();

    for (const deployment of activeDeployments) {
      try {
        // Collect fresh metrics
        const metrics = metricsCollector.collectMetrics(deployment.id);

        // Check health
        const healthReport = this.checkDeploymentHealth(deployment);

        if (!healthReport) continue;

        // Broadcast metrics update
        this.broadcast('metrics_update', {
          deploymentId: deployment.id,
          metrics,
          health: healthReport,
        });

        // Auto-rollback if unhealthy
        if (!healthReport.isHealthy) {
          const criticalIssues = healthReport.issues.filter(i => i.severity === 'critical');
          const reason = criticalIssues.map(i => i.message).join('; ');

          logger.warn(`Deployment #${deployment.id} UNHEALTHY: ${reason}`);

          // Auto-rollback
          const rolledBack = canaryManager.rollbackCanary(deployment.id, {
            reason: `Auto-rollback: ${reason}`,
            triggerType: 'auto',
            errorRate: healthReport.canary.errorRate,
            latency: healthReport.canary.latency,
            rolledBackBy: 'health-checker',
          });

          // Stop metrics collection
          metricsCollector.stopCollection(deployment.id);

          // Broadcast rollback event
          this.broadcast('rollback', {
            deploymentId: deployment.id,
            reason,
            healthReport,
            deployment: rolledBack,
          });

          logger.rollback(`Auto-rollback triggered for deployment #${deployment.id}`);
        } else {
          logger.metric(`Deployment #${deployment.id} HEALTHY — Error: ${healthReport.canary.errorRate}%, Latency: ${healthReport.canary.latency}ms`);
        }
      } catch (err) {
        logger.error(`Health check error for deployment #${deployment.id}:`, err.message);
      }
    }
  }

  /**
   * Start the health checker loop
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    const intervalMs = config.canary.healthCheckIntervalMs;

    this.checkInterval = setInterval(() => {
      this.runHealthCheck();
    }, intervalMs);

    logger.success(`Health checker started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop the health checker
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info('Health checker stopped');
  }
}

module.exports = new HealthChecker();
