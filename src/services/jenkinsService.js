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
      const http = require('http');
      const url = new URL(`${this.baseUrl}/job/${this.jobName}/build`);
      
      const auth = Buffer.from(`${this.user}:${this.token}`).toString('base64');
      
      return new Promise((resolve, reject) => {
        // First get CSRF crumb
        const crumbReq = http.request(`${this.baseUrl}/crumbIssuer/api/json`, {
          method: 'GET',
          headers: { 'Authorization': `Basic ${auth}` },
        }, (crumbRes) => {
          let crumbData = '';
          crumbRes.on('data', d => crumbData += d);
          crumbRes.on('end', () => {
            let crumbHeader = {};
            try {
              const crumb = JSON.parse(crumbData);
              crumbHeader[crumb.crumbRequestField] = crumb.crumb;
            } catch (e) { /* CSRF disabled */ }

            // Now trigger the build
            const buildReq = http.request(url.href, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${auth}`,
                ...crumbHeader,
              },
            }, (buildRes) => {
              if (buildRes.statusCode === 201 || buildRes.statusCode === 200 || buildRes.statusCode === 302) {
                logger.success(`Jenkins build triggered for job: ${this.jobName}`);
                resolve({ success: true, message: 'Build triggered successfully' });
              } else {
                let body = '';
                buildRes.on('data', d => body += d);
                buildRes.on('end', () => {
                  logger.error(`Jenkins build trigger failed: ${buildRes.statusCode}`);
                  resolve({ success: false, message: `Build trigger failed: ${buildRes.statusCode}` });
                });
              }
            });
            buildReq.on('error', (e) => {
              resolve({ success: false, message: `Cannot connect to Jenkins: ${e.message}` });
            });
            buildReq.end();
          });
        });
        crumbReq.on('error', () => {
          // Try without crumb
          const buildReq = http.request(url.href, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${auth}` },
          }, (buildRes) => {
            if (buildRes.statusCode === 201 || buildRes.statusCode === 200 || buildRes.statusCode === 302) {
              resolve({ success: true, message: 'Build triggered successfully' });
            } else {
              resolve({ success: false, message: `Build trigger failed: ${buildRes.statusCode}` });
            }
          });
          buildReq.on('error', (e) => {
            resolve({ success: false, message: `Cannot connect to Jenkins: ${e.message}` });
          });
          buildReq.end();
        });
        crumbReq.end();
      });
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
      const http = require('http');
      const auth = Buffer.from(`${this.user}:${this.token}`).toString('base64');
      const url = `${this.baseUrl}/job/${this.jobName}/lastBuild/api/json`;

      return new Promise((resolve) => {
        const req = http.request(url, {
          headers: { 'Authorization': `Basic ${auth}` },
        }, (res) => {
          let body = '';
          res.on('data', d => body += d);
          res.on('end', () => {
            try {
              const data = JSON.parse(body);
              resolve({
                success: true,
                build: {
                  number: data.number,
                  result: data.result,
                  building: data.building,
                  duration: data.duration,
                  timestamp: data.timestamp,
                  url: data.url,
                },
              });
            } catch (e) {
              resolve({ success: false, message: 'Could not parse build status' });
            }
          });
        });
        req.on('error', (e) => {
          resolve({ success: false, message: `Jenkins not available: ${e.message}` });
        });
        req.end();
      });
    } catch (error) {
      return { success: false, message: `Jenkins not available: ${error.message}` };
    }
  }

  /**
   * Get Jenkins server status
   */
  async getServerStatus() {
    try {
      const http = require('http');
      const auth = Buffer.from(`${this.user}:${this.token}`).toString('base64');

      return new Promise((resolve) => {
        const req = http.request(`${this.baseUrl}/api/json`, {
          headers: { 'Authorization': `Basic ${auth}` },
          timeout: 5000,
        }, (res) => {
          if (res.statusCode === 200) {
            resolve({ connected: true, url: this.baseUrl });
          } else {
            resolve({ connected: false, url: this.baseUrl });
          }
          res.resume();
        });
        req.on('error', () => {
          resolve({ connected: false, url: this.baseUrl, message: 'Jenkins server not reachable' });
        });
        req.on('timeout', () => {
          req.destroy();
          resolve({ connected: false, url: this.baseUrl, message: 'Jenkins timeout' });
        });
        req.end();
      });
    } catch {
      return { connected: false, url: this.baseUrl, message: 'Jenkins server not reachable' };
    }
  }
}

module.exports = new JenkinsService();
