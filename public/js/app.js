/**
 * Main Application Controller
 */
class App {
  constructor() {
    this.dashboard = new Dashboard();
    this.deploymentMgr = new DeploymentManager(this);
    this.ws = null;
    this.failureStates = new Map();
    this.selectedDeploymentId = null;
  }

  async init() {
    this.dashboard.initCharts();
    this.connectWebSocket();
    await this.loadAllData();
    this.bindEvents();
    this.startPolling();
    console.log('🐤 Canary Release Manager initialized');
  }

  connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${location.host}/ws`);
    this.ws.onopen = () => { this.setConnectionStatus(true); };
    this.ws.onclose = () => { this.setConnectionStatus(false); setTimeout(() => this.connectWebSocket(), 3000); };
    this.ws.onmessage = (e) => this.handleWsMessage(JSON.parse(e.data));
    this.ws.onerror = () => {};
  }

  setConnectionStatus(connected) {
    const bar = document.getElementById('connectionBar');
    if (bar) { bar.className = `connection-bar ${connected ? 'connected' : 'disconnected'}`; bar.textContent = connected ? 'Connected' : '⚠ Disconnected — Reconnecting...'; }
  }

  handleWsMessage(msg) {
    switch (msg.type) {
      case 'metrics_update':
        this.dashboard.updateAllCharts(msg.data.metrics);
        this.updateLiveMetrics(msg.data.metrics);
        if (msg.data.health && !msg.data.health.isHealthy) {
          this.showToast('warning', `⚠ Deployment #${msg.data.deploymentId} health issues detected`);
        }
        break;
      case 'rollback':
        this.showToast('error', `↩ Auto-rollback: Deployment #${msg.data.deploymentId} — ${msg.data.reason}`);
        this.loadAllData();
        break;
    }
  }

  updateLiveMetrics(metrics) {
    if (!metrics) return;
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    if (metrics.canary) {
      s('liveErrorRate', metrics.canary.errorRate + '%');
      s('liveLatency', metrics.canary.latencyMs + 'ms');
      s('liveCpu', metrics.canary.cpuPercent + '%');
      s('liveMemory', metrics.canary.memoryPercent + '%');
    }
  }

  async loadAllData() {
    try {
      const [depRes, logRes] = await Promise.all([API.getDeployments(), API.getRollbackLogs()]);
      if (depRes.success) { this.deploymentMgr.renderDeploymentList(depRes.data); this.deploymentMgr.updateStats(depRes.data); }
      if (logRes.success) this.deploymentMgr.renderRollbackTimeline(logRes.data);
      const active = depRes.data?.find(d => d.status === 'active' || d.status === 'promoting');
      if (active) { this.selectedDeploymentId = active.id; this.dashboard.updateTrafficDonut(100 - active.traffic_percent, active.traffic_percent);
        const el = document.getElementById('canaryTrafficPercent'); if (el) el.textContent = active.traffic_percent + '%';
        const el2 = document.getElementById('stableTrafficPercent'); if (el2) el2.textContent = (100 - active.traffic_percent) + '%';
      }
    } catch (err) { console.error('Load error:', err); }
  }

  bindEvents() {
    const form = document.getElementById('createDeploymentForm');
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); this.createDeployment(); });
    const modalClose = document.getElementById('closeModal');
    if (modalClose) modalClose.addEventListener('click', () => this.hideModal());
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) this.hideModal(); });
    document.getElementById('confirmRollback')?.addEventListener('click', () => this.executeRollback());
    document.getElementById('triggerJenkins')?.addEventListener('click', () => this.triggerJenkinsBuild());
  }

  async createDeployment() {
    const name = document.getElementById('depName')?.value;
    const stableVersion = document.getElementById('depStableVersion')?.value;
    const canaryVersion = document.getElementById('depCanaryVersion')?.value;
    const trafficPercent = parseInt(document.getElementById('depTraffic')?.value) || 10;
    const description = document.getElementById('depDescription')?.value;
    if (!name || !stableVersion || !canaryVersion) { this.showToast('error', 'Please fill in all required fields'); return; }
    try {
      const res = await API.createDeployment({ name, stableVersion, canaryVersion, trafficPercent, description });
      if (res.success) { this.showToast('success', `🚀 Deployment "${name}" created!`); document.getElementById('createDeploymentForm')?.reset(); await this.loadAllData(); }
    } catch (err) { this.showToast('error', `Failed: ${err.message}`); }
  }

  async promoteDeployment(id) {
    try {
      const res = await API.promoteDeployment(id, false);
      if (res.success) { this.showToast('success', `⬆ Deployment #${id} traffic increased to ${res.data.traffic_percent}%`); await this.loadAllData(); }
    } catch (err) { this.showToast('error', err.message); }
  }

  showRollbackModal(id) {
    this._rollbackTargetId = id;
    document.getElementById('rollbackReason').value = '';
    document.getElementById('modalOverlay')?.classList.add('active');
  }

  hideModal() { document.getElementById('modalOverlay')?.classList.remove('active'); }

  async executeRollback() {
    const reason = document.getElementById('rollbackReason')?.value || 'Manual rollback';
    try {
      const res = await API.rollbackDeployment(this._rollbackTargetId, reason);
      if (res.success) { this.showToast('error', `↩ Deployment #${this._rollbackTargetId} rolled back`); this.hideModal(); await this.loadAllData(); }
    } catch (err) { this.showToast('error', err.message); }
  }

  async toggleFailure(id) {
    const current = this.failureStates.get(id) || false;
    const next = !current;
    try {
      await API.simulateFailure(id, next);
      this.failureStates.set(id, next);
      this.showToast(next ? 'warning' : 'info', next ? `⚡ Failure simulation ENABLED for #${id}` : `✅ Failure simulation DISABLED for #${id}`);
    } catch (err) { this.showToast('error', err.message); }
  }

  async selectDeployment(id) { this.selectedDeploymentId = id; }

  async triggerJenkinsBuild() {
    try {
      const res = await API.triggerJenkinsBuild();
      this.showToast(res.data?.success ? 'success' : 'warning', res.data?.message || 'Jenkins build request sent');
    } catch (err) { this.showToast('warning', `Jenkins: ${err.message}`); }
  }

  startPolling() { setInterval(() => this.loadAllData(), 15000); }

  showToast(type, message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span class="toast-message">${message}</span><span class="toast-close" onclick="this.parentElement.remove()">✕</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 5000);
  }
}

// Initialize
let app;
document.addEventListener('DOMContentLoaded', () => { app = new App(); app.init(); });
