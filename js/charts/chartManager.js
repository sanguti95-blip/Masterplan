/**
 * Chart.js (v4.x) Manager for Executive Visualizations
 * 1. Matriz Estratégica GMROI de 4 Cuadrantes
 * 2. Ventas y Margen por Categoría
 * 3. Eficiencia de Capital (Stock vs Margen)
 * 4. Estacionalidad y Curvas de Tendencia
 */
const ChartManager = {
  charts: {
    gmroi: null,
    categories: null,
    capital: null,
    trends: null
  },

  themeColors: {
    oled: {
      text: '#e2e8f0',
      textMuted: '#94a3b8',
      grid: '#1e293b',
      border: '#334155',
      stars: '#10b981',        // Emerald
      cashCows: '#3b82f6',     // Blue
      opportunities: '#a855f7',// Purple
      drainers: '#ef4444'      // Red
    },
    dark: {
      text: '#e2e8f0',
      textMuted: '#94a3b8',
      grid: '#1e293b',
      border: '#334155',
      stars: '#10b981',
      cashCows: '#3b82f6',
      opportunities: '#a855f7',
      drainers: '#ef4444'
    },
    light: {
      text: '#1e293b',
      textMuted: '#64748b',
      grid: '#e2e8f0',
      border: '#cbd5e1',
      stars: '#059669',
      cashCows: '#2563eb',
      opportunities: '#9333ea',
      drainers: '#dc2626'
    }
  },

  getColors() {
    const theme = window.ThemeEngine ? window.ThemeEngine.currentTheme : 'oled';
    return this.themeColors[theme] || this.themeColors.oled;
  },

  updateThemeColors(themeName) {
    if (typeof Chart === 'undefined') return;
    Object.values(this.charts).forEach(chart => {
      if (chart) {
        chart.destroy();
      }
    });
    this.charts = { gmroi: null, categories: null, capital: null, trends: null };
    this.renderAllCharts();
  },

  // 1. GMROI 4-Quadrant Scatter Chart
  renderGmroiMatrix(gmroiData) {
    const canvas = document.getElementById('chart-gmroi-matrix');
    if (!canvas || typeof Chart === 'undefined') return;

    if (this.charts.gmroi) this.charts.gmroi.destroy();

    const colors = this.getColors();
    const { quadrants, avgTurnover, marginThreshold } = gmroiData;

    const datasets = [
      {
        label: '⭐ Estrellas (Alto Margen + Alta Rotación)',
        data: (quadrants.stars || []).map(p => ({ x: p.turnover, y: p.marginPct, label: p.name, sku: p.sku })),
        backgroundColor: colors.stars,
        borderColor: colors.stars,
        pointRadius: 6,
        pointHoverRadius: 9
      },
      {
        label: '🐮 Vacas Lecheras (Bajo Margen + Alta Rotación)',
        data: (quadrants.cashCows || []).map(p => ({ x: p.turnover, y: p.marginPct, label: p.name, sku: p.sku })),
        backgroundColor: colors.cashCows,
        borderColor: colors.cashCows,
        pointRadius: 5,
        pointHoverRadius: 8
      },
      {
        label: '💎 Oportunidades (Alto Margen + Baja Rotación)',
        data: (quadrants.opportunities || []).map(p => ({ x: p.turnover, y: p.marginPct, label: p.name, sku: p.sku })),
        backgroundColor: colors.opportunities,
        borderColor: colors.opportunities,
        pointRadius: 5,
        pointHoverRadius: 8
      },
      {
        label: '⚠️ Drenadores (Bajo Margen + Baja Rotación)',
        data: (quadrants.drainers || []).map(p => ({ x: p.turnover, y: p.marginPct, label: p.name, sku: p.sku })),
        backgroundColor: colors.drainers,
        borderColor: colors.drainers,
        pointRadius: 5,
        pointHoverRadius: 8
      }
    ];

    this.charts.gmroi = new Chart(canvas, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: colors.text, boxWidth: 12, font: { family: 'DM Sans', size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const pt = ctx.raw;
                return `${pt.label} (${pt.sku}) - Rotación: ${pt.x}x | Margen: ${pt.y}%`;
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Rotación de Inventario (Turnover)', color: colors.textMuted },
            grid: { color: colors.grid },
            ticks: { color: colors.textMuted }
          },
          y: {
            title: { display: true, text: 'Margen Bruto (%)', color: colors.textMuted },
            grid: { color: colors.grid },
            ticks: { color: colors.textMuted, callback: (v) => `${v}%` }
          }
        }
      }
    });
  },

  // 2. Sales by Category (Doughnut / Bar)
  renderCategoriesChart(categoriesData) {
    const canvas = document.getElementById('chart-categories-breakdown');
    if (!canvas || typeof Chart === 'undefined') return;

    if (this.charts.categories) this.charts.categories.destroy();

    const colors = this.getColors();
    const categories = categoriesData.categories || [];

    const labels = categories.map(c => c.category);
    const revenues = categories.map(c => c.totalRevenue);
    const profits = categories.map(c => c.totalProfit);

    this.charts.categories = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Ingresos Totales (₡)',
            data: revenues,
            backgroundColor: '#3b82f6',
            borderRadius: 6
          },
          {
            label: 'Margen Bruto (₡)',
            data: profits,
            backgroundColor: '#10b981',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: colors.text } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${AppFormatter.currency(ctx.raw)}`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: colors.textMuted } },
          y: {
            grid: { color: colors.grid },
            ticks: {
              color: colors.textMuted,
              callback: (v) => `₡${(v / 1000).toFixed(0)}k`
            }
          }
        }
      }
    });
  },

  // 3. Capital Efficiency Dual Bars
  renderCapitalEfficiencyChart(efficiencyData) {
    const canvas = document.getElementById('chart-capital-efficiency');
    if (!canvas || typeof Chart === 'undefined') return;

    if (this.charts.capital) this.charts.capital.destroy();

    const colors = this.getColors();
    const items = (efficiencyData.efficiencyList || []).slice(0, 10);

    this.charts.capital = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: items.map(i => i.name.slice(0, 20)),
        datasets: [
          {
            label: 'Capital Invertido en Stock (₡)',
            data: items.map(i => i.investedCapital),
            backgroundColor: '#64748b',
            borderRadius: 4
          },
          {
            label: 'Margen Bruto Generado (₡)',
            data: items.map(i => i.grossMarginGenerated),
            backgroundColor: '#10b981',
            borderRadius: 4
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: colors.text } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${AppFormatter.currency(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: colors.grid },
            ticks: { color: colors.textMuted, callback: (v) => `₡${(v / 1000).toFixed(0)}k` }
          },
          y: { grid: { display: false }, ticks: { color: colors.textMuted } }
        }
      }
    });
  },

  // 4. Seasonality & Trend Curves
  renderTrendsChart() {
    const canvas = document.getElementById('chart-trends-curves');
    if (!canvas || typeof Chart === 'undefined') return;

    if (this.charts.trends) this.charts.trends.destroy();

    const colors = this.getColors();
    const days = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4 (Actual)', 'Semana 5 (Proyectada)', 'Semana 6 (Proyectada)'];
    
    this.charts.trends = new Chart(canvas, {
      type: 'line',
      data: {
        labels: days,
        datasets: [
          {
            label: 'Consumo Real de Mercadería (Unidades)',
            data: [3850, 4120, 3980, 4350, null, null],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.35,
            pointRadius: 5
          },
          {
            label: 'Demanda Proyectada MRP (72h Lead Time)',
            data: [null, null, null, 4350, 4520, 4680],
            borderColor: '#10b981',
            borderDash: [5, 5],
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            fill: true,
            tension: 0.35,
            pointRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: colors.text } }
        },
        scales: {
          x: { grid: { color: colors.grid }, ticks: { color: colors.textMuted } },
          y: { grid: { color: colors.grid }, ticks: { color: colors.textMuted } }
        }
      }
    });
  },

  async renderAllCharts() {
    try {
      if (window.ApiClient) {
        const [gmroi, categories, capital] = await Promise.allSettled([
          window.ApiClient.getGmroiMatrix(),
          window.ApiClient.getCategoriesAnalytics(),
          window.ApiClient.getCapitalEfficiency()
        ]);

        if (gmroi.status === 'fulfilled') this.renderGmroiMatrix(gmroi.value);
        if (categories.status === 'fulfilled') this.renderCategoriesChart(categories.value);
        if (capital.status === 'fulfilled') this.renderCapitalEfficiencyChart(capital.value);
        this.renderTrendsChart();
      }
    } catch (e) {
      console.warn('Error loading charts data:', e);
    }
  }
};

window.ChartManager = ChartManager;
