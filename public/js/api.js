/**
 * API Client - Wrapper for REST API calls
 */
const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const config = {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      };

      if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
      }

      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  },

  // Deployment endpoints
  async getDeployments() {
    return this.request('/deployments');
  },

  async getActiveDeployments() {
    return this.request('/deployments/active');
  },

  async getDeployment(id) {
    return this.request(`/deployments/${id}`);
  },

  async createDeployment(data) {
    return this.request('/deployments', {
      method: 'POST',
      body: data,
    });
  },

  async promoteDeployment(id, full = false) {
    return this.request(`/deployments/${id}/promote`, {
      method: 'POST',
      body: { full },
    });
  },

  async rollbackDeployment(id, reason = '') {
    return this.request(`/deployments/${id}/rollback`, {
      method: 'POST',
      body: { reason },
    });
  },

  async simulateFailure(id, enable) {
    return this.request(`/deployments/${id}/simulate-failure`, {
      method: 'POST',
      body: { enable },
    });
  },

  // Metrics endpoints
  async getMetrics(deploymentId, limit = 60) {
    return this.request(`/metrics/${deploymentId}?limit=${limit}`);
  },

  async getMetricsSnapshot(deploymentId) {
    return this.request(`/metrics/${deploymentId}/snapshot`);
  },

  // Rollback logs
  async getRollbackLogs(limit = 50) {
    return this.request(`/rollback-logs?limit=${limit}`);
  },

  // Jenkins
  async triggerJenkinsBuild(params = {}) {
    return this.request('/jenkins/trigger', {
      method: 'POST',
      body: { params },
    });
  },

  async getJenkinsStatus() {
    return this.request('/jenkins/status');
  },

  async getJenkinsServerStatus() {
    return this.request('/jenkins/server');
  },

  // Health
  async getHealth() {
    return this.request('/health');
  },

  async getConfig() {
    return this.request('/config');
  },
};
