const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../utils/config');
const logger = require('../utils/logger');

// Ensure data directory exists
const dbDir = path.dirname(path.resolve(config.dbPath));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(path.resolve(config.dbPath));

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  logger.info('Initializing database...');

  // Deployments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS deployments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      stable_version TEXT NOT NULL,
      canary_version TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      traffic_percent INTEGER NOT NULL DEFAULT 10,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      promoted_at TEXT,
      rolled_back_at TEXT,
      description TEXT,
      created_by TEXT DEFAULT 'system'
    )
  `);

  // Metrics table - stores health metrics snapshots
  db.exec(`
    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deployment_id INTEGER NOT NULL,
      instance_type TEXT NOT NULL CHECK(instance_type IN ('stable', 'canary')),
      error_rate REAL NOT NULL,
      latency_ms REAL NOT NULL,
      cpu_percent REAL NOT NULL,
      memory_percent REAL NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      failure_count INTEGER NOT NULL DEFAULT 0,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (deployment_id) REFERENCES deployments(id)
    )
  `);

  // Rollback logs - audit trail
  db.exec(`
    CREATE TABLE IF NOT EXISTS rollback_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deployment_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      trigger_type TEXT NOT NULL CHECK(trigger_type IN ('auto', 'manual', 'jenkins')),
      error_rate_at_rollback REAL,
      latency_at_rollback REAL,
      rolled_back_at TEXT NOT NULL DEFAULT (datetime('now')),
      rolled_back_by TEXT DEFAULT 'system',
      FOREIGN KEY (deployment_id) REFERENCES deployments(id)
    )
  `);

  // Audit trail - all system events
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_trail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      deployment_id INTEGER,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      actor TEXT DEFAULT 'system'
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_metrics_deployment ON metrics(deployment_id);
    CREATE INDEX IF NOT EXISTS idx_metrics_recorded ON metrics(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_rollback_deployment ON rollback_logs(deployment_id);
    CREATE INDEX IF NOT EXISTS idx_audit_deployment ON audit_trail(deployment_id);
    CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
  `);

  logger.success('Database initialized successfully');
}

// Auto-initialize tables on first load
initializeDatabase();

// Prepared statements for frequent operations
const statements = {
  insertDeployment: db.prepare(`
    INSERT INTO deployments (name, stable_version, canary_version, status, traffic_percent, description, created_by)
    VALUES (@name, @stableVersion, @canaryVersion, @status, @trafficPercent, @description, @createdBy)
  `),

  getDeployment: db.prepare('SELECT * FROM deployments WHERE id = ?'),
  
  getAllDeployments: db.prepare('SELECT * FROM deployments ORDER BY created_at DESC'),
  
  getActiveDeployments: db.prepare("SELECT * FROM deployments WHERE status IN ('active', 'promoting') ORDER BY created_at DESC"),

  updateDeploymentStatus: db.prepare(`
    UPDATE deployments SET status = @status, updated_at = datetime('now') WHERE id = @id
  `),

  updateTrafficPercent: db.prepare(`
    UPDATE deployments SET traffic_percent = @trafficPercent, updated_at = datetime('now') WHERE id = @id
  `),

  promoteDeployment: db.prepare(`
    UPDATE deployments SET status = 'promoted', traffic_percent = 100, promoted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
  `),

  rollbackDeployment: db.prepare(`
    UPDATE deployments SET status = 'rolled_back', traffic_percent = 0, rolled_back_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
  `),

  insertMetric: db.prepare(`
    INSERT INTO metrics (deployment_id, instance_type, error_rate, latency_ms, cpu_percent, memory_percent, request_count, success_count, failure_count)
    VALUES (@deploymentId, @instanceType, @errorRate, @latencyMs, @cpuPercent, @memoryPercent, @requestCount, @successCount, @failureCount)
  `),

  getRecentMetrics: db.prepare(`
    SELECT * FROM metrics WHERE deployment_id = ? ORDER BY recorded_at DESC LIMIT ?
  `),

  getMetricsByType: db.prepare(`
    SELECT * FROM metrics WHERE deployment_id = ? AND instance_type = ? ORDER BY recorded_at DESC LIMIT ?
  `),

  insertRollbackLog: db.prepare(`
    INSERT INTO rollback_logs (deployment_id, reason, trigger_type, error_rate_at_rollback, latency_at_rollback, rolled_back_by)
    VALUES (@deploymentId, @reason, @triggerType, @errorRateAtRollback, @latencyAtRollback, @rolledBackBy)
  `),

  getRollbackLogs: db.prepare('SELECT * FROM rollback_logs ORDER BY rolled_back_at DESC LIMIT ?'),

  getRollbackLogsByDeployment: db.prepare('SELECT * FROM rollback_logs WHERE deployment_id = ? ORDER BY rolled_back_at DESC'),

  insertAuditEvent: db.prepare(`
    INSERT INTO audit_trail (event_type, deployment_id, details, actor)
    VALUES (@eventType, @deploymentId, @details, @actor)
  `),

  getAuditTrail: db.prepare('SELECT * FROM audit_trail ORDER BY created_at DESC LIMIT ?'),
};

module.exports = { db, initializeDatabase, statements };
