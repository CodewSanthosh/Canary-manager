const { statements } = require('../db/database');
const logger = require('../utils/logger');
const config = require('../utils/config');

class CanaryManager {
  constructor() {
    this.activeMonitors = new Map(); // deploymentId -> interval
  }

  /**
   * Create a new canary deployment
   */
  createDeployment({ name, stableVersion, canaryVersion, trafficPercent, description, createdBy }) {
    const traffic = trafficPercent || config.canary.defaultTrafficPercent;

    const result = statements.insertDeployment.run({
      name,
      stableVersion,
      canaryVersion,
      status: 'active',
      trafficPercent: traffic,
      description: description || '',
      createdBy: createdBy || 'dashboard',
    });

    const deployment = statements.getDeployment.get(result.lastInsertRowid);

    // Log audit event
    statements.insertAuditEvent.run({
      eventType: 'DEPLOYMENT_CREATED',
      deploymentId: deployment.id,
      details: JSON.stringify({
        stableVersion,
        canaryVersion,
        trafficPercent: traffic,
      }),
      actor: createdBy || 'dashboard',
    });

    logger.deploy(`Created deployment #${deployment.id}: ${name} (${stableVersion} → ${canaryVersion}) at ${traffic}% canary traffic`);
    return deployment;
  }

  /**
   * Get a deployment by ID
   */
  getDeployment(id) {
    return statements.getDeployment.get(id);
  }

  /**
   * Get all deployments
   */
  getAllDeployments() {
    return statements.getAllDeployments.all();
  }

  /**
   * Get active deployments
   */
  getActiveDeployments() {
    return statements.getActiveDeployments.all();
  }

  /**
   * Increase canary traffic percentage (step promotion)
   */
  stepPromote(deploymentId) {
    const deployment = statements.getDeployment.get(deploymentId);
    if (!deployment) throw new Error(`Deployment #${deploymentId} not found`);
    if (deployment.status !== 'active' && deployment.status !== 'promoting') {
      throw new Error(`Cannot promote deployment in '${deployment.status}' state`);
    }

    const newPercent = Math.min(
      deployment.traffic_percent + config.canary.promotionStepPercent,
      100
    );

    if (newPercent >= 100) {
      return this.promoteCanary(deploymentId);
    }

    statements.updateTrafficPercent.run({
      id: deploymentId,
      trafficPercent: newPercent,
    });
    statements.updateDeploymentStatus.run({
      id: deploymentId,
      status: 'promoting',
    });

    statements.insertAuditEvent.run({
      eventType: 'TRAFFIC_INCREASED',
      deploymentId,
      details: JSON.stringify({
        previousPercent: deployment.traffic_percent,
        newPercent,
      }),
      actor: 'dashboard',
    });

    logger.deploy(`Deployment #${deploymentId}: Traffic increased ${deployment.traffic_percent}% → ${newPercent}%`);
    return statements.getDeployment.get(deploymentId);
  }

  /**
   * Fully promote canary to stable (100% traffic)
   */
  promoteCanary(deploymentId) {
    const deployment = statements.getDeployment.get(deploymentId);
    if (!deployment) throw new Error(`Deployment #${deploymentId} not found`);
    if (deployment.status === 'promoted' || deployment.status === 'rolled_back') {
      throw new Error(`Deployment already ${deployment.status}`);
    }

    statements.promoteDeployment.run(deploymentId);

    statements.insertAuditEvent.run({
      eventType: 'DEPLOYMENT_PROMOTED',
      deploymentId,
      details: JSON.stringify({
        canaryVersion: deployment.canary_version,
        message: 'Canary promoted to production',
      }),
      actor: 'dashboard',
    });

    logger.success(`Deployment #${deploymentId}: Canary ${deployment.canary_version} promoted to production!`);
    return statements.getDeployment.get(deploymentId);
  }

  /**
   * Rollback canary deployment
   */
  rollbackCanary(deploymentId, { reason, triggerType, errorRate, latency, rolledBackBy }) {
    const deployment = statements.getDeployment.get(deploymentId);
    if (!deployment) throw new Error(`Deployment #${deploymentId} not found`);
    if (deployment.status === 'rolled_back') {
      throw new Error('Deployment already rolled back');
    }

    // Update deployment status
    statements.rollbackDeployment.run(deploymentId);

    // Create rollback log entry
    statements.insertRollbackLog.run({
      deploymentId,
      reason,
      triggerType: triggerType || 'manual',
      errorRateAtRollback: errorRate || null,
      latencyAtRollback: latency || null,
      rolledBackBy: rolledBackBy || 'dashboard',
    });

    // Log audit event
    statements.insertAuditEvent.run({
      eventType: 'DEPLOYMENT_ROLLED_BACK',
      deploymentId,
      details: JSON.stringify({ reason, triggerType, errorRate, latency }),
      actor: rolledBackBy || 'dashboard',
    });

    logger.rollback(`Deployment #${deploymentId}: Rolled back! Reason: ${reason}`);
    return statements.getDeployment.get(deploymentId);
  }

  /**
   * Get traffic split for a deployment
   */
  getTrafficSplit(deploymentId) {
    const deployment = statements.getDeployment.get(deploymentId);
    if (!deployment) throw new Error(`Deployment #${deploymentId} not found`);

    return {
      deploymentId: deployment.id,
      status: deployment.status,
      stablePercent: 100 - deployment.traffic_percent,
      canaryPercent: deployment.traffic_percent,
      stableVersion: deployment.stable_version,
      canaryVersion: deployment.canary_version,
    };
  }

  /**
   * Get rollback logs
   */
  getRollbackLogs(limit = 50) {
    return statements.getRollbackLogs.all(limit);
  }

  /**
   * Get rollback logs for a specific deployment
   */
  getRollbackLogsByDeployment(deploymentId) {
    return statements.getRollbackLogsByDeployment.all(deploymentId);
  }

  /**
   * Get audit trail
   */
  getAuditTrail(limit = 100) {
    return statements.getAuditTrail.all(limit);
  }
}

module.exports = new CanaryManager();
