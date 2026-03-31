const { statements } = require('../db/database');
const config = require('../utils/config');
const logger = require('../utils/logger');

class MetricsCollector {
  constructor() {
    this.failureMode = new Map(); // deploymentId -> boolean
    this.collectionIntervals = new Map();
  }

  /**
   * Generate a random value with some noise around a base value
   */
  _withNoise(base, noisePercent = 15) {
    const noise = base * (noisePercent / 100);
    return base + (Math.random() * 2 - 1) * noise;
  }

  /**
   * Generate metrics for the stable instance
   */
  _generateStableMetrics(deploymentId) {
    const sim = config.simulation;
    const requestCount = Math.floor(Math.random() * 500) + 800;
    const errorRate = this._withNoise(sim.baseErrorRate, 20);
    const failureCount = Math.floor(requestCount * (errorRate / 100));

    return {
      deploymentId,
      instanceType: 'stable',
      errorRate: parseFloat(errorRate.toFixed(2)),
      latencyMs: parseFloat(this._withNoise(sim.baseLatency, 15).toFixed(1)),
      cpuPercent: parseFloat(this._withNoise(sim.baseCpu, 10).toFixed(1)),
      memoryPercent: parseFloat(this._withNoise(sim.baseMemory, 8).toFixed(1)),
      requestCount,
      successCount: requestCount - failureCount,
      failureCount,
    };
  }

  /**
   * Generate metrics for the canary instance
   */
  _generateCanaryMetrics(deploymentId) {
    const sim = config.simulation;
    const isFailure = this.failureMode.get(deploymentId) || false;

    const requestCount = Math.floor(Math.random() * 200) + 100;

    let errorRate, latency, cpu, memory;

    if (isFailure) {
      // Simulate a failing canary
      errorRate = this._withNoise(sim.failureErrorRate, 25);
      latency = this._withNoise(sim.failureLatency, 20);
      cpu = this._withNoise(75, 15);
      memory = this._withNoise(80, 10);
    } else {
      // Normal canary (slightly higher than stable)
      errorRate = this._withNoise(sim.baseErrorRate * sim.canaryErrorMultiplier, 30);
      latency = this._withNoise(sim.baseLatency * sim.canaryLatencyMultiplier, 20);
      cpu = this._withNoise(sim.baseCpu + 5, 12);
      memory = this._withNoise(sim.baseMemory + 3, 10);
    }

    const failureCount = Math.floor(requestCount * (errorRate / 100));

    return {
      deploymentId,
      instanceType: 'canary',
      errorRate: parseFloat(Math.max(0, errorRate).toFixed(2)),
      latencyMs: parseFloat(Math.max(10, latency).toFixed(1)),
      cpuPercent: parseFloat(Math.min(100, Math.max(0, cpu)).toFixed(1)),
      memoryPercent: parseFloat(Math.min(100, Math.max(0, memory)).toFixed(1)),
      requestCount,
      successCount: requestCount - failureCount,
      failureCount: Math.max(0, failureCount),
    };
  }

  /**
   * Collect and store metrics for a deployment
   */
  collectMetrics(deploymentId) {
    const stableMetrics = this._generateStableMetrics(deploymentId);
    const canaryMetrics = this._generateCanaryMetrics(deploymentId);

    statements.insertMetric.run(stableMetrics);
    statements.insertMetric.run(canaryMetrics);

    return { stable: stableMetrics, canary: canaryMetrics };
  }

  /**
   * Start collecting metrics for a deployment at regular intervals
   */
  startCollection(deploymentId, intervalMs) {
    if (this.collectionIntervals.has(deploymentId)) {
      this.stopCollection(deploymentId);
    }

    const interval = setInterval(() => {
      try {
        this.collectMetrics(deploymentId);
      } catch (err) {
        logger.error(`Metrics collection error for deployment #${deploymentId}:`, err.message);
      }
    }, intervalMs || config.canary.healthCheckIntervalMs);

    this.collectionIntervals.set(deploymentId, interval);
    logger.info(`Started metrics collection for deployment #${deploymentId}`);
  }

  /**
   * Stop collecting metrics for a deployment
   */
  stopCollection(deploymentId) {
    const interval = this.collectionIntervals.get(deploymentId);
    if (interval) {
      clearInterval(interval);
      this.collectionIntervals.delete(deploymentId);
      logger.info(`Stopped metrics collection for deployment #${deploymentId}`);
    }
  }

  /**
   * Enable failure simulation for a deployment's canary
   */
  enableFailureMode(deploymentId) {
    this.failureMode.set(deploymentId, true);
    logger.warn(`Failure mode ENABLED for deployment #${deploymentId} canary`);
  }

  /**
   * Disable failure simulation
   */
  disableFailureMode(deploymentId) {
    this.failureMode.set(deploymentId, false);
    logger.info(`Failure mode DISABLED for deployment #${deploymentId} canary`);
  }

  /**
   * Get recent metrics for a deployment
   */
  getRecentMetrics(deploymentId, limit = 60) {
    return statements.getRecentMetrics.all(deploymentId, limit);
  }

  /**
   * Get metrics by instance type
   */
  getMetricsByType(deploymentId, instanceType, limit = 30) {
    return statements.getMetricsByType.all(deploymentId, instanceType, limit);
  }

  /**
   * Get the latest metrics snapshot
   */
  getLatestSnapshot(deploymentId) {
    const stable = statements.getMetricsByType.all(deploymentId, 'stable', 1);
    const canary = statements.getMetricsByType.all(deploymentId, 'canary', 1);

    return {
      stable: stable[0] || null,
      canary: canary[0] || null,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Stop all active collections
   */
  stopAll() {
    for (const [id] of this.collectionIntervals) {
      this.stopCollection(id);
    }
    this.failureMode.clear();
  }
}

module.exports = new MetricsCollector();
