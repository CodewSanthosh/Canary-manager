require('dotenv').config();

const config = {
  // Server
  port: parseInt(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Jenkins
  jenkins: {
    url: process.env.JENKINS_URL || 'http://localhost:8080',
    user: process.env.JENKINS_USER || 'admin',
    token: process.env.JENKINS_TOKEN || '',
    jobName: process.env.JENKINS_JOB_NAME || 'canary-pipeline',
  },

  // Canary Defaults
  canary: {
    defaultTrafficPercent: parseInt(process.env.CANARY_TRAFFIC_PERCENT) || 10,
    errorRateThreshold: parseFloat(process.env.ERROR_RATE_THRESHOLD) || 5.0,
    latencyThresholdMs: parseInt(process.env.LATENCY_THRESHOLD_MS) || 500,
    healthCheckIntervalMs: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS) || 10000,
    maxPromotionSteps: 5,  // Steps to go from canary% to 100%
    promotionStepPercent: 20, // Increase by 20% each step
  },

  // Database
  dbPath: process.env.DB_PATH || './data/canary.db',

  // Metric Simulation
  simulation: {
    baseErrorRate: 0.5,       // 0.5% base error rate for stable
    baseLatency: 120,         // 120ms base latency for stable
    baseCpu: 35,              // 35% base CPU for stable
    baseMemory: 45,           // 45% base memory for stable
    canaryErrorMultiplier: 1.2, // Canary has slightly higher errors
    canaryLatencyMultiplier: 1.1,
    failureErrorRate: 12,     // Error rate during failure scenario
    failureLatency: 850,      // Latency during failure
  }
};

module.exports = config;
