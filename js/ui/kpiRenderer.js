/**
 * Realtime KPI Metric Cards Renderer including Manual Variance Tracking
 */
const KpiRenderer = {
  elements: null,

  init() {
    this.elements = {
      totalCost: document.getElementById('kpi-total-cost'),
      itemsCount: document.getElementById('kpi-items-count'),
      criticalCount: document.getElementById('kpi-critical-count'),
      totalUnits: document.getElementById('kpi-total-units'),
      totalBoxes: document.getElementById('kpi-total-boxes'),
      varianceCost: document.getElementById('kpi-variance-cost'),
      varianceSubtext: document.getElementById('kpi-variance-subtext')
    };
  },

  render(kpiData) {
    if (!this.elements || !this.elements.totalCost) this.init();

    if (this.elements.totalCost) {
      this.elements.totalCost.innerText = AppFormatter.currency(kpiData.totalCost || 0);
    }
    if (this.elements.itemsCount) {
      this.elements.itemsCount.innerText = AppFormatter.number(kpiData.totalItemsToOrder || 0);
    }
    if (this.elements.criticalCount) {
      this.elements.criticalCount.innerText = AppFormatter.number(kpiData.totalCriticalCount || 0);
    }
    if (this.elements.totalUnits) {
      this.elements.totalUnits.innerText = AppFormatter.number(kpiData.totalUnits || 0);
    }
    if (this.elements.totalBoxes) {
      this.elements.totalBoxes.innerText = `${AppFormatter.number(kpiData.totalBoxes || 0)} cjas`;
    }

    // Variance calculation
    if (this.elements.varianceCost) {
      const variance = kpiData.varianceCost || 0;
      const varianceSign = variance > 0 ? '+' : '';
      this.elements.varianceCost.innerText = `${varianceSign}${AppFormatter.currency(variance)}`;
      
      if (variance === 0) {
        this.elements.varianceCost.className = 'kpi-value';
        if (this.elements.varianceSubtext) this.elements.varianceSubtext.innerText = '100% apego al sugerido de compra';
      } else if (variance > 0) {
        this.elements.varianceCost.className = 'kpi-value text-amber';
        const pct = kpiData.suggestedCost > 0 ? ((variance / kpiData.suggestedCost) * 100).toFixed(1) : '100';
        if (this.elements.varianceSubtext) this.elements.varianceSubtext.innerText = `+${pct}% sobre pedido sugerido`;
      } else {
        this.elements.varianceCost.className = 'kpi-value text-primary';
        const pct = kpiData.suggestedCost > 0 ? ((Math.abs(variance) / kpiData.suggestedCost) * 100).toFixed(1) : '100';
        if (this.elements.varianceSubtext) this.elements.varianceSubtext.innerText = `-${pct}% bajo pedido sugerido`;
      }
    }
  }
};

window.KpiRenderer = KpiRenderer;
