/**
 * Master Planning MRP CODISA - Main Application Orchestrator
 * Autor / Product Owner: Milton Sánchez Gutiérrez
 * Versión: 2.0 (Impeccable Polished Suite)
 */
class MrpApp {
  constructor() {
    this.executionDay = 'Lunes';
    this.safetyStock = 1;
    this.searchQuery = '';
    this.activeFilter = 'all';
    this.selectedCategory = 'all';
    this.sortColumn = 'totalOrderCost';
    this.sortDirection = 'desc';
    this.activeTab = 'planner';
    this.items = [];
    this.calculatedItems = [];
    this.activeOrders = [];
    this.isSyncing = false;
  }

  async init() {
    // 1. Initialize UI Helpers
    if (window.ThemeEngine) window.ThemeEngine.init();
    if (window.Toast) window.Toast.init();
    if (window.ModalManager) window.ModalManager.init();
    if (window.CommandPalette) window.CommandPalette.init();
    if (window.TableRenderer) {
      window.TableRenderer.init((col, dir) => {
        this.sortColumn = col;
        this.sortDirection = dir;
        this.recalculateAndRender();
      });
    }
    if (window.KpiRenderer) window.KpiRenderer.init();

    // 2. Attach UI Listeners
    this.attachDomListeners();

    // 3. Register PWA Service Worker
    this.registerServiceWorker();

    // 4. Load Data from Backend or Local Fallback
    await this.loadInitialData();

    // 5. Initial Render
    this.recalculateAndRender();

    // 6. Update Status
    const statusEl = document.getElementById('data-status-text');
    if (statusEl) {
      statusEl.innerText = `Sistema MRP listo. ${this.items.length} SKUs en catálogo maestro.`;
    }
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('Service Worker registration skipped:', err.message);
      });
    }
  }

  attachDomListeners() {
    // Tab Navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabId = tab.dataset.tab;
        if (tabId) this.switchTab(tabId);
      });
    });

    // Day Switcher (Lunes, Martes, Miércoles, Jueves)
    document.querySelectorAll('.day-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const day = btn.dataset.day;
        if (day) this.setExecutionDay(day);
      });
    });

    // Filter Buttons (Todos, Críticos, En Tránsito, Con Pedido)
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.filter || 'all';
        this.recalculateAndRender();
      });
    });

    // Category Filter Dropdown
    const catFilter = document.getElementById('category-filter');
    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        this.selectedCategory = e.target.value;
        this.recalculateAndRender();
      });
    }

    // Search Input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.recalculateAndRender();
      });
    }

    // Safety Stock Config Input
    const cfgSs = document.getElementById('cfg-safety-stock');
    if (cfgSs) {
      cfgSs.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val >= 0) {
          this.safetyStock = val;
          this.recalculateAndRender();
          window.Toast.show(`Stock de Seguridad actualizado a ${val} días.`, 'info');
        }
      });
    }

    // Approve & Export Order Button (Opens Executive Confirmation Modal)
    const btnApprove = document.getElementById('btn-approve-order');
    if (btnApprove) {
      btnApprove.addEventListener('click', () => this.approveAndExportOrder());
    }

    // Direct Export Excel Button
    const btnExportExcel = document.getElementById('btn-export-excel');
    if (btnExportExcel) {
      btnExportExcel.addEventListener('click', () => this.exportToExcel());
    }

    // Trigger Live Sync Button
    const btnSync = document.getElementById('btn-trigger-sync');
    if (btnSync) {
      btnSync.addEventListener('click', () => this.triggerLiveSync());
    }

    // Batch Action: Apply Suggested
    const btnBatchSuggest = document.getElementById('btn-batch-apply-suggested');
    if (btnBatchSuggest) {
      btnBatchSuggest.addEventListener('click', () => this.applyBatchSuggested());
    }

    // Batch Action: Clear Final Order
    const btnBatchZero = document.getElementById('btn-batch-set-zero');
    if (btnBatchZero) {
      btnBatchZero.addEventListener('click', () => this.applyBatchZero());
    }
  }

  switchTab(tabId) {
    this.activeTab = tabId;

    // Update Nav buttons
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabId);
    });

    // Update View Panels
    document.querySelectorAll('.view-panel').forEach(p => {
      p.classList.toggle('active', p.id === `view-${tabId}`);
    });

    // Lazy load charts when analytics/gmroi tab is opened
    if (tabId === 'gmroi' || tabId === 'analytics') {
      setTimeout(() => {
        if (window.ChartManager) window.ChartManager.renderAllCharts();
      }, 50);
    } else if (tabId === 'transit') {
      this.renderTransitTab();
    } else if (tabId === 'sync') {
      this.renderSyncTab();
    }
  }

  setExecutionDay(day) {
    this.executionDay = day;

    // Update day buttons
    document.querySelectorAll('.day-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.day === day);
    });

    // Update Day Metadata Banner
    const matrix = window.APP_CONFIG.planningMatrix[day] || window.APP_CONFIG.planningMatrix.Lunes;
    const bannerDay = document.getElementById('matrix-banner-day');
    const bannerDelivery = document.getElementById('matrix-banner-delivery');
    const bannerCoverage = document.getElementById('matrix-banner-coverage');
    const bannerTransit = document.getElementById('matrix-banner-transit');

    if (bannerDay) bannerDay.innerText = matrix.dayName;
    if (bannerDelivery) bannerDelivery.innerText = matrix.deliveryDay;
    if (bannerCoverage) bannerCoverage.innerText = `${matrix.coverageDays} día(s)`;
    if (bannerTransit) bannerTransit.innerText = matrix.activeTransitDays.join(', ');

    window.Toast.show(`Cálculo MRP actualizado para ${matrix.dayName} (Ingreso: ${matrix.deliveryDay})`, 'info');
    this.recalculateAndRender();
  }

  setSearchQuery(q) {
    this.searchQuery = q;
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = q;
    this.recalculateAndRender();
  }

  async loadInitialData() {
    try {
      // 1. Try fetching from Backend API
      if (window.ApiClient) {
        const [planRes, transitRes] = await Promise.allSettled([
          window.ApiClient.getPlanningCalculation(this.executionDay, this.safetyStock),
          window.ApiClient.getTransitOrders()
        ]);

        if (planRes.status === 'fulfilled' && planRes.value && planRes.value.items) {
          this.items = planRes.value.items;
          if (transitRes.status === 'fulfilled' && transitRes.value && transitRes.value.orders) {
            this.activeOrders = transitRes.value.orders;
          }
          return;
        }
      }
    } catch (e) {
      console.warn('Backend fetch failed, falling back to local data.js:', e);
    }

    // Fallback to local data.js
    if (typeof INITIAL_PEDIDOS !== 'undefined' && typeof INITIAL_DATA !== 'undefined') {
      const dataMap = new Map();
      INITIAL_DATA.forEach(row => {
        if (row.NO_ARTI !== undefined) {
          dataMap.set(row.NO_ARTI.toString().trim().toUpperCase(), row);
        }
      });

      this.items = INITIAL_PEDIDOS.map(row => {
        const codeFrumusa = (row['Codigo frumusa'] !== undefined ? row['Codigo frumusa'] : '').toString().trim();
        const codeCountry = (row['Código country'] !== undefined ? row['Código country'] : '').toString().trim();
        const match = dataMap.get(codeFrumusa.toUpperCase()) || dataMap.get(codeCountry.toUpperCase());

        let stock = Number(row['Stock'] || 0);
        if (match && match['SALDO_ACTUAL'] !== undefined) stock = Number(match['SALDO_ACTUAL']);

        let sales = Number(row['Ventas del período'] || 0);
        if (match && match['CANTIDAD'] !== undefined) sales = Number(match['CANTIDAD']);

        let cost = 0;
        if (match && match['COSTO_UNITARIO'] !== undefined) cost = Number(match['COSTO_UNITARIO']);

        const transitSaved = localStorage.getItem(`mrp_transit_${codeFrumusa || codeCountry}`);
        const transit = transitSaved !== null ? Number(transitSaved) : Number(row['Transito'] || 0);

        return {
          code_country: codeCountry,
          code_frumusa: codeFrumusa,
          description: row['Descripción'] || (match ? match['ARTICULO'] : ''),
          category: row['Categoría'] || (match ? match['CATEGORIA'] : 'General'),
          stock_actual: stock,
          sales_period: sales,
          days_period: Number(row['Días del período'] || 30),
          unit_cost: cost,
          unit_price: match ? Number(match['PRECIO'] || 0) : cost * 1.35,
          transit_qty: transit,
          pack_multiple: Number(row['Múltiplo de pedido'] || 1),
          safety_stock_days: Number(row['Covertura meta'] || 1),
          pedidoFinalOverride: null
        };
      });
    }
  }

  recalculateAndRender() {
    let totalCost = 0;
    let suggestedCost = 0;
    let totalItemsToOrder = 0;
    let totalCriticalCount = 0;
    let totalUnits = 0;
    let totalBoxes = 0;

    const q = (this.searchQuery || '').toLowerCase().trim();

    this.calculatedItems = this.items.map(prod => {
      const calc = window.MrpEngine.calculateItem(prod, this.executionDay, this.activeOrders, this.safetyStock);

      // Accumulate totals across all products
      totalCost += calc.totalOrderCost;
      suggestedCost += (calc.suggestedUnits * calc.unitCost);

      if (calc.finalQty > 0) {
        totalItemsToOrder++;
        totalUnits += calc.finalQty;
        totalBoxes += calc.finalBoxes;
      }
      if (calc.isCritical) {
        totalCriticalCount++;
      }

      return calc;
    });

    const varianceCost = totalCost - suggestedCost;

    // Filter items for Table view (Search + State filter + Category filter)
    const filtered = this.calculatedItems.filter(item => {
      if (q) {
        const matchesQ = item.description.toLowerCase().includes(q) ||
          item.codeFrumusa.toLowerCase().includes(q) ||
          item.codeCountry.toLowerCase().includes(q);
        if (!matchesQ) return false;
      }

      if (this.selectedCategory !== 'all' && item.category !== this.selectedCategory) {
        return false;
      }

      if (this.activeFilter === 'critical') return item.isCritical;
      if (this.activeFilter === 'transit') return item.activeTransit > 0;
      if (this.activeFilter === 'to-order') return item.finalQty > 0;

      return true;
    });

    // Render Table
    if (window.TableRenderer) {
      window.TableRenderer.render(filtered, (type, sku, val) => {
        this.handleInlineUpdate(type, sku, val);
      });
    }

    // Render KPIs including Variance
    if (window.KpiRenderer) {
      window.KpiRenderer.render({
        totalCost,
        suggestedCost,
        varianceCost,
        totalItemsToOrder,
        totalCriticalCount,
        totalUnits,
        totalBoxes
      });
    }
  }

  handleInlineUpdate(type, sku, val) {
    const prod = this.items.find(p => (
      (p.code_frumusa && p.code_frumusa.toString() === sku) ||
      (p.codeFrumusa && p.codeFrumusa.toString() === sku) ||
      (p.code_country && p.code_country.toString() === sku) ||
      (p.codeSku && p.codeSku.toString() === sku)
    ));

    if (!prod) return;

    if (type === 'stock') {
      prod.stock_actual = val;
      prod.stock = val;
    } else if (type === 'transit') {
      prod.transit_qty = val;
      prod.transit = val;
      localStorage.setItem(`mrp_transit_${sku}`, val);
    } else if (type === 'override') {
      prod.pedidoFinalOverride = val;
    }

    this.recalculateAndRender();
  }

  applyBatchSuggested() {
    const selected = window.TableRenderer.selectedSkus;
    if (selected.size === 0) return;

    let count = 0;
    this.items.forEach(p => {
      const sku = (p.code_frumusa || p.codeFrumusa || p.code_country || p.codeSku || '').toString();
      if (selected.has(sku)) {
        p.pedidoFinalOverride = null; // Revert to suggested
        count++;
      }
    });

    window.Toast.show(`Se aplicó el pedido sugerido por algoritmo a ${count} SKUs.`, 'success');
    this.recalculateAndRender();
  }

  applyBatchZero() {
    const selected = window.TableRenderer.selectedSkus;
    if (selected.size === 0) return;

    let count = 0;
    this.items.forEach(p => {
      const sku = (p.code_frumusa || p.codeFrumusa || p.code_country || p.codeSku || '').toString();
      if (selected.has(sku)) {
        p.pedidoFinalOverride = 0;
        count++;
      }
    });

    window.Toast.show(`Se fijó en 0 el pedido final para ${count} SKUs.`, 'warning');
    this.recalculateAndRender();
  }

  approveAndExportOrder() {
    const itemsToOrder = this.calculatedItems.filter(i => i.finalQty > 0);

    if (itemsToOrder.length === 0) {
      window.Toast.show('No hay artículos con cantidad mayor a 0 para aprobar.', 'warning');
      return;
    }

    const matrix = window.APP_CONFIG.planningMatrix[this.executionDay] || window.APP_CONFIG.planningMatrix.Lunes;
    const now = new Date();
    const orderCode = `ORD-${this.executionDay.toUpperCase()}-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Date.now().toString().slice(-4)}`;

    let grandTotalCost = 0;
    let suggestedTotalCost = 0;
    let grandTotalUnits = 0;
    let grandTotalBoxes = 0;

    itemsToOrder.forEach(i => {
      grandTotalCost += i.totalOrderCost;
      suggestedTotalCost += (i.suggestedUnits * i.unitCost);
      grandTotalUnits += i.finalQty;
      grandTotalBoxes += i.finalBoxes;
    });

    const varianceCost = grandTotalCost - suggestedTotalCost;

    const summary = {
      executionDay: this.executionDay,
      deliveryDay: matrix.deliveryDay,
      skuCount: itemsToOrder.length,
      boxCount: grandTotalBoxes,
      totalCost: grandTotalCost,
      suggestedCost: suggestedTotalCost,
      varianceCost: varianceCost
    };

    // Open Executive Confirmation Modal
    if (window.ModalManager) {
      window.ModalManager.showApprovalConfirmation(summary, () => {
        this.executeApprovedOrder(itemsToOrder, matrix, now, orderCode, grandTotalCost, grandTotalUnits, grandTotalBoxes);
      });
    } else {
      this.executeApprovedOrder(itemsToOrder, matrix, now, orderCode, grandTotalCost, grandTotalUnits, grandTotalBoxes);
    }
  }

  executeApprovedOrder(itemsToOrder, matrix, now, orderCode, grandTotalCost, grandTotalUnits, grandTotalBoxes) {
    const newOrder = {
      id: orderCode,
      orderCode,
      executionDay: this.executionDay,
      deliveryDay: matrix.deliveryDay,
      createdAt: now.toISOString(),
      expectedDeliveryDate: new Date(Date.now() + 72 * 3600 * 1000).toISOString().slice(0, 10),
      status: 'EN_TRANSITO',
      totalCost: grandTotalCost,
      totalUnits: grandTotalUnits,
      totalBoxes: grandTotalBoxes,
      totalItems: itemsToOrder.length,
      items: itemsToOrder
    };

    // 1. Add to Active Orders in Memory
    this.activeOrders.unshift(newOrder);

    // 2. Transfer approved order to transit for matching products
    itemsToOrder.forEach(orderItem => {
      const prod = this.items.find(p => (
        (p.code_frumusa && p.code_frumusa.toString() === orderItem.codeSku) ||
        (p.codeFrumusa && p.codeFrumusa.toString() === orderItem.codeSku) ||
        (p.code_country && p.code_country.toString() === orderItem.codeSku)
      ));
      if (prod) {
        prod.transit_qty = (Number(prod.transit_qty || 0)) + orderItem.finalQty;
        prod.transit = prod.transit_qty;
        localStorage.setItem(`mrp_transit_${orderItem.codeSku}`, prod.transit_qty);
        prod.pedidoFinalOverride = null; // Clear override
      }
    });

    // 3. Try notifying backend
    if (window.ApiClient) {
      window.ApiClient.approveOrder({
        executionDay: this.executionDay,
        items: itemsToOrder
      }).catch(err => console.warn('Backend sync failed (running standalone):', err.message));
    }

    // 4. Automatic Corporate Excel (.xlsx) Download
    const excelFilename = `Pedido_Final_${this.executionDay}_${now.toISOString().slice(0, 10)}.xlsx`;
    window.ExcelExporter.exportOrderToXlsx({
      executionDay: this.executionDay,
      deliveryDay: matrix.deliveryDay,
      orderCode,
      items: itemsToOrder,
      totalCost: grandTotalCost,
      totalUnits: grandTotalUnits,
      totalBoxes: grandTotalBoxes
    }, excelFilename);

    window.Toast.show(`¡Orden ${orderCode} aprobada con éxito! Descargando ${excelFilename}...`, 'success', 5000);
    this.recalculateAndRender();
  }

  exportToExcel() {
    const itemsToOrder = this.calculatedItems.filter(i => i.finalQty > 0);
    if (itemsToOrder.length === 0) {
      window.Toast.show('No hay artículos con pedido para exportar.', 'warning');
      return;
    }

    const matrix = window.APP_CONFIG.planningMatrix[this.executionDay] || window.APP_CONFIG.planningMatrix.Lunes;
    const now = new Date();
    const filename = `Borrador_Pedido_${this.executionDay}_${now.toISOString().slice(0, 10)}.xlsx`;

    let grandTotalCost = 0;
    let grandTotalUnits = 0;
    let grandTotalBoxes = 0;

    itemsToOrder.forEach(i => {
      grandTotalCost += i.totalOrderCost;
      grandTotalUnits += i.finalQty;
      grandTotalBoxes += i.finalBoxes;
    });

    window.ExcelExporter.exportOrderToXlsx({
      executionDay: this.executionDay,
      deliveryDay: matrix.deliveryDay,
      orderCode: `DRAFT-${this.executionDay.toUpperCase()}`,
      items: itemsToOrder,
      totalCost: grandTotalCost,
      totalUnits: grandTotalUnits,
      totalBoxes: grandTotalBoxes
    }, filename);

    window.Toast.show(`Exportando ${itemsToOrder.length} artículos a ${filename}...`, 'info');
  }

  async triggerLiveSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    const btnSync = document.getElementById('btn-trigger-sync');
    const syncStatus = document.getElementById('sync-last-status');
    const syncTime = document.getElementById('sync-last-time');

    if (btnSync) {
      btnSync.disabled = true;
      btnSync.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando...';
    }

    window.Toast.show('Iniciando sincronización con Google Apps Script...', 'info');

    try {
      if (window.ApiClient) {
        const res = await window.ApiClient.triggerSync();
        if (res && res.success) {
          window.Toast.show(`¡Sincronización exitosa! ${res.log.matchedSkus} SKUs actualizados.`, 'success');
          if (syncStatus) syncStatus.innerText = 'Sincronizado';
          if (syncTime) syncTime.innerText = new Date().toLocaleTimeString('es-CR');
          await this.loadInitialData();
          this.recalculateAndRender();
        } else {
          throw new Error(res.message || 'Error en sync');
        }
      }
    } catch (err) {
      window.Toast.show(`Error al sincronizar: ${err.message}`, 'error');
    } finally {
      this.isSyncing = false;
      if (btnSync) {
        btnSync.disabled = false;
        btnSync.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> Sincronizar Ahora';
      }
    }
  }

  renderTransitTab() {
    const grid = document.getElementById('transit-orders-grid');
    if (!grid) return;

    if (this.activeOrders.length === 0) {
      grid.innerHTML = `
        <div class="empty-transit-state" style="grid-column: 1 / -1;">
          <i class="fa-solid fa-truck-ramp-box"></i>
          <p>No hay órdenes aprobadas actualmente en tránsito.</p>
          <span style="font-size: 0.8rem; color: var(--text-dim);">Cuando apruebes un pedido en el Planeador, aparecerá aquí como tránsito activo de 72h.</span>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.activeOrders.map(order => `
      <div class="transit-card">
        <div class="transit-card-header">
          <div class="transit-card-title">
            <i class="fa-solid fa-receipt text-primary"></i>
            <strong class="font-mono">${order.orderCode}</strong>
          </div>
          <span class="badge-day">${order.executionDay}</span>
        </div>
        <div class="transit-meta-grid">
          <div>
            <span class="meta-label">Ingreso Físico:</span>
            <strong>${order.deliveryDay} (72h)</strong>
          </div>
          <div>
            <span class="meta-label">Total SKUs:</span>
            <strong class="font-mono">${order.totalItems} artículos</strong>
          </div>
          <div>
            <span class="meta-label">Total Cajas:</span>
            <strong class="font-mono">${order.totalBoxes} cjas</strong>
          </div>
          <div>
            <span class="meta-label">Total Inversión:</span>
            <strong class="font-mono text-primary">${AppFormatter.currency(order.totalCost)}</strong>
          </div>
        </div>
        <div class="transit-card-footer">
          <button class="btn-secondary btn-small" onclick="window.MrpAppInstance.downloadOrderXlsx('${order.orderCode}')">
            <i class="fa-solid fa-file-excel"></i> Re-descargar Excel
          </button>
        </div>
      </div>
    `).join('');
  }

  renderSyncTab() {
    // Injected with sync status info
  }

  downloadOrderXlsx(orderCode) {
    const order = this.activeOrders.find(o => o.orderCode === orderCode);
    if (!order) return;

    window.ExcelExporter.exportOrderToXlsx({
      executionDay: order.executionDay,
      deliveryDay: order.deliveryDay,
      orderCode: order.orderCode,
      items: order.items,
      totalCost: order.totalCost,
      totalUnits: order.totalUnits,
      totalBoxes: order.totalBoxes
    }, `${order.orderCode}.xlsx`);

    window.Toast.show(`Descargando archivo Excel para ${orderCode}...`, 'info');
  }
}

// Instantiate and start app
document.addEventListener('DOMContentLoaded', () => {
  window.MrpAppInstance = new MrpApp();
  window.App = window.MrpAppInstance;
  window.MrpAppInstance.init();
});
