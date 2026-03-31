const config = require('../utils/config');
const logger = require('../utils/logger');

class JenkinsService {
  constructor() {
    this.baseUrl = config.jenkins.url;
    this.user = config.jenkins.user;
    this.token = config.jenkins.token;
    this.jobName = config.jenkins.jobName;
  }

  /**
   * Get authorization header for Jenkins API
   */
  _getAuthHeader() {
    const credentials = Buffer.from(`${this.user}:${this.token}`).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * Trigger a Jenkins build
   */
  async triggerBuild(params = {}) {
    try {
      const fetch = require('node-fetch');
      const url = `${this.baseUrl}/job/${this.jobName}/buildWithParameters`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': this._getAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params).toString(),
      });

      if (response.status === 201) {
        logger.success(`Jenkins build triggered for job: ${this.jobName}`);
        return { success: true, message: 'Build triggered successfully' };
      } else {
        const text = await response.text();
        logger.error(`Jenkins build trigger failed: ${response.status} ${text}`);
        return { success: false, message: `Build trigger failed: ${response.status}` };
      }
    } catch (error) {
      logger.error(`Jenkins connection error: ${error.message}`);
      return {
        success: false,
        message: `Cannot connect to Jenkins at ${this.baseUrl}. Ensure Jenkins is running.`,
        error: error.message,
      };
    }
  }

  /**
   * Get the status of the last build
   */
  async getLastBuildStatus() {
    try {
      const fetch = require('node-fetch');
      const url = `${this.baseUrl}/job/${this.jobName}/lastBuild/api/json`;

      const response = await fetch(url, {
        headers: { 'Authorization': this._getAuthHeader() },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          build: {
            number: data.number,
            result: data.result,
            building: data.building,
            duration: data.duration,
            timestamp: data.timestamp,
            url: data.url,
          },
        };
      } else {
        return { success: false, message: 'Could not fetch build status' };
      }
    } catch (error) {
      return {
        success: false,
        message: `Jenkins not available: ${error.message}`,
        // Return simulated data for demo purposes
        build: {
          number: 42,
          result: 'SUCCESS',
          building: false,
          duration: 45000,
          timestamp: Date.now() - 300000,
          url: `${this.baseUrl}/job/${this.jobName}/42/`,
          simulated: true,
        },
      };
    }
  }

  /**
   * Get Jenkins server status
   */
  async getServerStatus() {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(`${this.baseUrl}/api/json`, {
        headers: { 'Authorization': this._getAuthHeader() },
        timeout: 5000,
      });

      if (response.ok) {
        return { connected: true, url: this.baseUrl };
      }
      return { connected: false, url: this.baseUrl };
    } catch {
      return { connected: false, url: this.baseUrl, message: 'Jenkins server not reachable' };
    }
  }
}

module.exports = new JenkinsService();
