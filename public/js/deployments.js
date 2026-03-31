/**
 * Deployments UI Manager
 */
class DeploymentManager {
  constructor(app) {
    this.app = app;
    this.selectedDeploymentId = null;
  }

  renderDeploymentList(deployments) {
    const container = document.getElementById('deploymentList');
    if (!container) return;
    if (!deployments || deployments.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">🚀</div><p>No deployments yet. Create your first canary deployment!</p></div>';
      return;
    }
    container.innerHTML = deployments.map(dep => this._renderItem(dep)).join('');
  }

  _renderItem(dep) {
    const actions = (dep.status === 'active' || dep.status === 'promoting') ?
      `<button class="btn btn-success btn-sm" onclick="event.stopPropagation();app.promoteDeployment(${dep.id})">⬆ Promote</button>
       <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();app.showRollbackModal(${dep.id})">↩ Rollback</button>
       <button class="btn btn-warning btn-sm" onclick="event.stopPropagation();app.toggleFailure(${dep.id})">⚡ Fail</button>` : '';

    return `<div class="deployment-item" data-id="${dep.id}" onclick="app.selectDeployment(${dep.id})">
      <div class="deployment-info">
        <div><div class="name">${dep.name}</div><div class="versions">${dep.stable_version} → ${dep.canary_version}</div></div>
        <span class="status-badge ${this._statusClass(dep.status)}"><span class="status-dot ${this._dotColor(dep.status)}"></span>${dep.status}</span>
      </div>
      <div class="deployment-actions">${actions}</div>
    </div>`;
  }

  renderRollbackTimeline(logs) {
    const c = document.getElementById('rollbackTimeline');
    if (!c) return;
    if (!logs || logs.length === 0) { c.innerHTML = '<div class="empty-state"><div class="icon">✅</div><p>No rollbacks yet</p></div>'; return; }
    c.innerHTML = logs.map(l => `<div class="timeline-item ${l.trigger_type}">
      <div class="time">${new Date(l.rolled_back_at).toLocaleString()}</div>
      <div class="reason">${l.reason}</div>
      <span class="trigger ${l.trigger_type}">${l.trigger_type}</span>
      ${l.error_rate_at_rollback ? `<div style="margin-top:6px;font-size:11px;color:var(--text-muted);font-family:var(--font-mono)">Error:${l.error_rate_at_rollback}% | Latency:${l.latency_at_rollback}ms</div>` : ''}
    </div>`).join('');
  }

  updateStats(deployments) {
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    s('totalDeployments', deployments.length);
    s('activeCanaries', deployments.filter(d => d.status === 'active' || d.status === 'promoting').length);
    s('promoted', deployments.filter(d => d.status === 'promoted').length);
    s('rolledBack', deployments.filter(d => d.status === 'rolled_back').length);
  }

  _statusClass(s) { return { active:'active', promoting:'warning', promoted:'promoted', rolled_back:'danger', pending:'info' }[s] || 'info'; }
  _dotColor(s) { return { active:'green', promoting:'yellow', promoted:'green', rolled_back:'red', pending:'yellow' }[s] || 'yellow'; }
}
