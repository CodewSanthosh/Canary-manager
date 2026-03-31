/**
 * Canary Release Manager - Integration Tests
 */
const assert = require('assert');

// Simple test runner
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

console.log('\n🧪 Canary Release Manager - Tests\n');

// ---- Config Tests ----
console.log('📦 Config:');
test('config loads without errors', () => {
  const config = require('../src/utils/config');
  assert(config.port, 'port should be defined');
  assert(config.canary, 'canary config should be defined');
});

test('config has valid thresholds', () => {
  const config = require('../src/utils/config');
  assert(config.canary.errorRateThreshold > 0, 'error threshold should be > 0');
  assert(config.canary.latencyThresholdMs > 0, 'latency threshold should be > 0');
  assert(config.canary.defaultTrafficPercent > 0 && config.canary.defaultTrafficPercent <= 100);
});

// ---- Logger Tests ----
console.log('\n📝 Logger:');
test('logger has all methods', () => {
  const logger = require('../src/utils/logger');
  assert(typeof logger.info === 'function');
  assert(typeof logger.success === 'function');
  assert(typeof logger.warn === 'function');
  assert(typeof logger.error === 'function');
  assert(typeof logger.deploy === 'function');
  assert(typeof logger.rollback === 'function');
});

// ---- Database Tests ----
console.log('\n💾 Database:');
test('database initializes without errors', () => {
  const { initializeDatabase, db } = require('../src/db/database');
  initializeDatabase();
  assert(db, 'db should be defined');
});

test('database has correct tables', () => {
  const { db } = require('../src/db/database');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const names = tables.map(t => t.name);
  assert(names.includes('deployments'), 'should have deployments table');
  assert(names.includes('metrics'), 'should have metrics table');
  assert(names.includes('rollback_logs'), 'should have rollback_logs table');
  assert(names.includes('audit_trail'), 'should have audit_trail table');
});

// ---- Canary Manager Tests ----
console.log('\n🐤 Canary Manager:');
const canaryManager = require('../src/services/canaryManager');

test('create deployment', () => {
  const dep = canaryManager.createDeployment({
    name: 'test-service',
    stableVersion: 'v1.0.0',
    canaryVersion: 'v1.1.0',
    trafficPercent: 10,
    description: 'Test deployment',
  });
  assert(dep.id, 'should have an id');
  assert.strictEqual(dep.status, 'active');
  assert.strictEqual(dep.traffic_percent, 10);
});

test('get deployment', () => {
  const dep = canaryManager.getAllDeployments()[0];
  const fetched = canaryManager.getDeployment(dep.id);
  assert.strictEqual(fetched.name, 'test-service');
});

test('get traffic split', () => {
  const dep = canaryManager.getAllDeployments()[0];
  const split = canaryManager.getTrafficSplit(dep.id);
  assert.strictEqual(split.stablePercent, 90);
  assert.strictEqual(split.canaryPercent, 10);
});

test('step promote increases traffic', () => {
  const dep = canaryManager.getAllDeployments()[0];
  const promoted = canaryManager.stepPromote(dep.id);
  assert.strictEqual(promoted.traffic_percent, 30); // 10 + 20
});

test('rollback deployment', () => {
  const dep = canaryManager.createDeployment({
    name: 'rollback-test',
    stableVersion: 'v2.0',
    canaryVersion: 'v2.1',
  });
  const rolled = canaryManager.rollbackCanary(dep.id, {
    reason: 'High error rate',
    triggerType: 'auto',
    errorRate: 12.5,
    latency: 850,
  });
  assert.strictEqual(rolled.status, 'rolled_back');
});

test('rollback log created', () => {
  const logs = canaryManager.getRollbackLogs(10);
  assert(logs.length > 0, 'should have rollback logs');
  assert.strictEqual(logs[0].reason, 'High error rate');
});

// ---- Metrics Collector Tests ----
console.log('\n📊 Metrics Collector:');
const metricsCollector = require('../src/services/metricsCollector');

test('collect metrics generates data', () => {
  const dep = canaryManager.getAllDeployments()[0];
  const metrics = metricsCollector.collectMetrics(dep.id);
  assert(metrics.stable, 'should have stable metrics');
  assert(metrics.canary, 'should have canary metrics');
  assert(metrics.stable.errorRate >= 0);
  assert(metrics.canary.latencyMs > 0);
});

test('failure mode increases error rate', () => {
  const dep = canaryManager.getAllDeployments()[0];
  metricsCollector.enableFailureMode(dep.id);
  const metrics = metricsCollector.collectMetrics(dep.id);
  // Failure mode should produce higher error rates
  assert(metrics.canary.errorRate > 1, `Error rate ${metrics.canary.errorRate} should be elevated`);
  metricsCollector.disableFailureMode(dep.id);
});

test('get latest snapshot', () => {
  const dep = canaryManager.getAllDeployments()[0];
  const snap = metricsCollector.getLatestSnapshot(dep.id);
  assert(snap.stable, 'snapshot should have stable');
  assert(snap.canary, 'snapshot should have canary');
});

// ---- Results ----
console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'─'.repeat(40)}\n`);

// Cleanup
const { db } = require('../src/db/database');
db.close();

// Clean up test database
const fs = require('fs');
const path = require('path');
const dbPath = path.resolve('./data/canary.db');
if (fs.existsSync(dbPath)) {
  try { fs.unlinkSync(dbPath); } catch {}
  try { fs.unlinkSync(dbPath + '-wal'); } catch {}
  try { fs.unlinkSync(dbPath + '-shm'); } catch {}
}

process.exit(failed > 0 ? 1 : 0);
