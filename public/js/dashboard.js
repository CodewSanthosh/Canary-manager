/**
 * Dashboard - Real-time charts and metrics visualization
 */
class Dashboard {
  constructor() {
    this.charts = {};
    this.maxDataPoints = 30;
    this.chartColors = {
      stable: { line: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
      canary: { line: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
      danger: { line: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
    };
  }

  /**
   * Initialize all charts
   */
  initCharts() {
    this.createErrorRateChart();
    this.createLatencyChart();
    this.createCpuChart();
    this.createMemoryChart();
    this.createTrafficDonut();
  }

  /**
   * Common chart options for a line chart
   */
  _lineChartOptions(title, yLabel, thresholdValue = null) {
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 11 },
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(99, 102, 241, 0.3)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'JetBrains Mono', size: 12 },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: {
            color: '#64748b',
            font: { family: 'JetBrains Mono', size: 10 },
            maxTicksLimit: 8,
          },
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: {
            color: '#64748b',
            font: { family: 'JetBrains Mono', size: 10 },
          },
          title: {
            display: true,
            text: yLabel,
            color: '#64748b',
            font: { family: 'Inter', size: 11 },
          },
        },
      },
      animation: {
        duration: 400,
        easing: 'easeOutQuart',
      },
    };

    // Add threshold annotation line
    if (thresholdValue !== null) {
      options.plugins.annotation = {
        annotations: {
          threshold: {
            type: 'line',
            yMin: thresholdValue,
            yMax: thresholdValue,
            borderColor: 'rgba(239, 68, 68, 0.5)',
            borderWidth: 2,
            borderDash: [6, 4],
            label: {
              display: true,
              content: `Threshold: ${thresholdValue}`,
              position: 'end',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
              font: { size: 10 },
            },
          },
        },
      };
    }

    return options;
  }

  /**
   * Create a dataset for a line chart
   */
  _createDataset(label, color, data = []) {
    return {
      label,
      data,
      borderColor: color.line,
      backgroundColor: color.bg,
      fill: true,
      tension: 0.4,
      pointRadius: 2,
      pointHoverRadius: 5,
      borderWidth: 2,
    };
  }

  createErrorRateChart() {
    const ctx = document.getElementById('errorRateChart');
    if (!ctx) return;

    this.charts.errorRate = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          this._createDataset('Stable', this.chartColors.stable),
          this._createDataset('Canary', this.chartColors.canary),
        ],
      },
      options: this._lineChartOptions('Error Rate', 'Error Rate (%)', 5),
    });
  }

  createLatencyChart() {
    const ctx = document.getElementById('latencyChart');
    if (!ctx) return;

    this.charts.latency = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          this._createDataset('Stable', this.chartColors.stable),
          this._createDataset('Canary', this.chartColors.canary),
        ],
      },
      options: this._lineChartOptions('Latency', 'Latency (ms)', 500),
    });
  }

  createCpuChart() {
    const ctx = document.getElementById('cpuChart');
    if (!ctx) return;

    this.charts.cpu = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          this._createDataset('Stable', this.chartColors.stable),
          this._createDataset('Canary', this.chartColors.canary),
        ],
      },
      options: this._lineChartOptions('CPU Usage', 'CPU (%)'),
    });
  }

  createMemoryChart() {
    const ctx = document.getElementById('memoryChart');
    if (!ctx) return;

    this.charts.memory = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          this._createDataset('Stable', this.chartColors.stable),
          this._createDataset('Canary', this.chartColors.canary),
        ],
      },
      options: this._lineChartOptions('Memory Usage', 'Memory (%)'),
    });
  }

  createTrafficDonut() {
    const ctx = document.getElementById('trafficDonut');
    if (!ctx) return;

    this.charts.traffic = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Stable', 'Canary'],
        datasets: [{
          data: [90, 10],
          backgroundColor: ['#10b981', '#6366f1'],
          borderWidth: 0,
          borderRadius: 4,
          spacing: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(99, 102, 241, 0.3)',
            borderWidth: 1,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.parsed}%`,
            },
          },
        },
        animation: {
          animateRotate: true,
          duration: 600,
        },
      },
    });
  }

  /**
   * Update a line chart with new data point
   */
  updateLineChart(chartName, stableValue, canaryValue) {
    const chart = this.charts[chartName];
    if (!chart) return;

    const time = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    chart.data.labels.push(time);
    chart.data.datasets[0].data.push(stableValue);
    chart.data.datasets[1].data.push(canaryValue);

    // Keep only last N data points
    if (chart.data.labels.length > this.maxDataPoints) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
      chart.data.datasets[1].data.shift();
    }

    chart.update('none');
  }

  /**
   * Update traffic donut chart
   */
  updateTrafficDonut(stablePercent, canaryPercent) {
    const chart = this.charts.traffic;
    if (!chart) return;

    chart.data.datasets[0].data = [stablePercent, canaryPercent];
    chart.update();

    // Update center text
    const centerEl = document.querySelector('.traffic-center .percent');
    if (centerEl) centerEl.textContent = `${canaryPercent}%`;
  }

  /**
   * Update all charts with metrics data
   */
  updateAllCharts(metrics) {
    if (!metrics || !metrics.stable || !metrics.canary) return;

    const { stable, canary } = metrics;

    this.updateLineChart('errorRate', stable.errorRate, canary.errorRate);
    this.updateLineChart('latency', stable.latencyMs, canary.latencyMs);
    this.updateLineChart('cpu', stable.cpuPercent, canary.cpuPercent);
    this.updateLineChart('memory', stable.memoryPercent, canary.memoryPercent);
  }

  /**
   * Destroy all charts
   */
  destroyAll() {
    for (const chart of Object.values(this.charts)) {
      if (chart) chart.destroy();
    }
    this.charts = {};
  }
}
