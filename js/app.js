/**
 * Master Planning MRP CODISA - Main Application Orchestrator
 * Autor / Product Owner: Milton Sánchez Gutiérrez
 * Versión: 2.0 (Impeccable Polished Suite)
 */
class MrpApp {
  constructor() {
    this.executionDay = 'Lunes';
    this.safetyStock = 1;
    this.vdpDays = 60;
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
    this.catalogSearchQuery = '';
    this.catalogSelectedCategory = 'all';
  }

  getAutoDetectedDay() {
    const dayIdx = new Date().getDay(); // 0 = Dom, 1 = Lun, 2 = Mar, 3 = Mie, 4 = Jue, 5 = Vie, 6 = Sab
    if (dayIdx === 1) return 'Lunes';
    if (dayIdx === 2) return 'Martes';
    if (dayIdx === 3) return 'Miercoles';
    if (dayIdx === 4) return 'Jueves';
    return 'Lunes'; // Predeterminado para viernes y fines de semana
  }

  getProduceCategory(desc) {
    const d = (desc || '').toUpperCase();
    if (d.includes('CULANTRO') || d.includes('OREGANO') || d.includes('ORÉGANO') || 
        d.includes('PEREJIL') || d.includes('ROMERO') || d.includes('TOMILLO') || 
        d.includes('ALBAHACA') || d.includes('HIERBABUENA') || d.includes('MENTA') || 
        d.includes('LAUREL') || d.includes('ESTRAGON') || d.includes('ESTRAGÓN') || 
        d.includes('ENELDO') || d.includes('CEBOLLIN') || d.includes('CEBOLLINO') || 
        d.includes('AJO') || d.includes('ENCHILADO') || d.includes('ZACATE') || d.includes('COYOL')) {
      return 'Hierbas y Aromáticas';
    }
    if (d.includes('LECHUGA') || d.includes('REPOLLO') || d.includes('ESPINACA') || 
        d.includes('ACELGA') || d.includes('APIO') || d.includes('BROCOLI') || 
        d.includes('BRÓCOLI') || d.includes('COLIFLOR') || d.includes('BERRO') || 
        d.includes('KALE') || d.includes('RUCULA') || d.includes('RÚCULA') || 
        d.includes('REPOLLITAS') || d.includes('MOSTAZA') || d.includes('COLES')) {
      return 'Hortalizas y Hojas';
    }
    if (d.includes('PAPA') || d.includes('ZANAHORIA') || d.includes('CEBOLLA') || 
        d.includes('YUCA') || d.includes('CAMOTE') || d.includes('REMOLACHA') || 
        d.includes('RABANO') || d.includes('RÁBANO') || d.includes('ÑAMPI') || 
        d.includes('TIKISQUE') || d.includes('MALANGA') || d.includes('JENGIBRE') || 
        d.includes('CURCUMA') || d.includes('CÚRCUMA') || d.includes('ARRACACHE') || 
        d.includes('NAME') || d.includes('ÑAME') || d.includes('PICHICHI')) {
      return 'Tubérculos y Raíces';
    }
    if (d.includes('TOMATE') || d.includes('CHILE') || d.includes('CHAYOTE') || 
        d.includes('PEPINO') || d.includes('ZUCCHINI') || d.includes('CALABAZA') || 
        d.includes('BERENJENA') || d.includes('AYOTE') || d.includes('VAINA') || 
        d.includes('VAINICA') || d.includes('MAIZ') || d.includes('MAÍZ') || 
        d.includes('ELOTE') || d.includes('PIPINIAN') || d.includes('PIPIAN')) {
      return 'Vegetales de Fruto';
    }
    if (d.includes('PLATANO') || d.includes('PLÁTANO') || d.includes('BANANO') || 
        d.includes('AGUACATE') || d.includes('PAPAYA') || d.includes('LIMON') || 
        d.includes('LIMÓN') || d.includes('MANGA') || d.includes('MANGO') || 
        d.includes('NARANJA') || d.includes('FRESA') || d.includes('PINA') || 
        d.includes('PIÑA') || d.includes('SANDIA') || d.includes('SANDÍA') || 
        d.includes('MELON') || d.includes('MELÓN') || d.includes('MANZANA') || 
        d.includes('UVA') || d.includes('PERA') || d.includes('DURAZNO') || 
        d.includes('KIWI') || d.includes('GRANADILLA') || d.includes('MARACUYA') || 
        d.includes('MARACUYÁ') || d.includes('GUINEO') || d.includes('MANDARINA') || 
        d.includes('MORA') || d.includes('ARANDANO') || d.includes('ARÁNDANO') || 
        d.includes('CIRUELA') || d.includes('COCO') || d.includes('GUANABANA') || 
        d.includes('TAMARINDO') || d.includes('JOCOTE') || d.includes('ZAPOTE') || 
        d.includes('CARAMBOLA') || d.includes('CAS') || d.includes('MAMON') || d.includes('MAMÓN') ||
        d.includes('PITAHAYA') || d.includes('GUAYABA')) {
      return 'Frutas Frescas';
    }
    return 'Otros Perecederos';
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

    // 2. Detección Automática del Día Actual
    this.executionDay = this.getAutoDetectedDay();
    this.updateDaySelectorUi(this.executionDay);

    // 3. Attach UI Listeners
    this.attachDomListeners();

    // 4. Register PWA Service Worker
    this.registerServiceWorker();

    // 5. Load Data from Backend or Local Fallback
    await this.loadInitialData();

    // 6. Initial Render
    this.recalculateAndRender();

    // 7. Update Status
    const statusEl = document.getElementById('data-status-text');
    if (statusEl) {
      statusEl.innerText = `Sistema de Abastecimiento listo. ${this.items.length} SKUs en catálogo maestro.`;
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
    // Sidebar Collapse / Expand Toggle
    const layout = document.querySelector('.app-layout');
    const toggleSidebarBtn = document.getElementById('btn-toggle-sidebar');
    const toggleSidebarHeaderBtn = document.getElementById('btn-toggle-sidebar-header');

    if (localStorage.getItem('mrp_sidebar_collapsed') === 'true' && layout) {
      layout.classList.add('sidebar-collapsed');
    }

    const toggleSidebar = () => {
      if (!layout) return;
      layout.classList.toggle('sidebar-collapsed');
      const isCollapsed = layout.classList.contains('sidebar-collapsed');
      localStorage.setItem('mrp_sidebar_collapsed', isCollapsed ? 'true' : 'false');
    };

    if (toggleSidebarBtn) toggleSidebarBtn.addEventListener('click', toggleSidebar);
    if (toggleSidebarHeaderBtn) toggleSidebarHeaderBtn.addEventListener('click', toggleSidebar);

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

    // Period / VDP Window Filter Dropdown (Recálculo Inmediato)
    const periodFilter = document.getElementById('period-filter');
    if (periodFilter) {
      periodFilter.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val > 0) {
          this.vdpDays = val;
          this.items.forEach(item => {
            item.days_period = this.vdpDays;
            item.daysPeriod = this.vdpDays;
            if (val === 60 && item.sales_60d) {
              item.vdp = item.sales_60d / 50;
            } else if (val <= 30 && item.days_in_month_cut) {
              item.vdp = (item.sales_period || item.CANTIDAD || 0) / item.days_in_month_cut;
            } else {
              item.vdp = (item.sales_period || item.CANTIDAD || 0) / val;
            }
          });
          this.recalculateAndRender();
          window.Toast.show(`Ventana VDP actualizada a ${val} días. Sugeridos recalculados en vivo.`, 'info');
        }
      });
    }

    // Catalog Editor Search & Filter
    const catalogSearch = document.getElementById('catalog-search-input');
    if (catalogSearch) {
      catalogSearch.addEventListener('input', (e) => {
        this.catalogSearchQuery = e.target.value;
        this.renderCatalogEditor();
      });
    }

    const catalogCatFilter = document.getElementById('catalog-category-filter');
    if (catalogCatFilter) {
      catalogCatFilter.addEventListener('change', (e) => {
        this.catalogSelectedCategory = e.target.value;
        this.renderCatalogEditor();
      });
    }

    const catalogStatusFilter = document.getElementById('catalog-status-filter');
    if (catalogStatusFilter) {
      catalogStatusFilter.addEventListener('change', (e) => {
        this.catalogSelectedStatus = e.target.value;
        this.renderCatalogEditor();
      });
    }

    const btnCatalogSave = document.getElementById('btn-catalog-save-all');
    if (btnCatalogSave) {
      btnCatalogSave.addEventListener('click', () => {
        this.saveAllCatalogChanges();
      });
    }

    const btnCatalogReset = document.getElementById('btn-catalog-reset');
    if (btnCatalogReset) {
      btnCatalogReset.addEventListener('click', () => {
        this.resetCatalogToFactory();
      });
    }

    // Catalog Table Delegation for Status Toggle and Row Save (CSP compliant)
    const catalogTbody = document.getElementById('catalog-table-body');
    if (catalogTbody) {
      catalogTbody.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.btn-status-toggle');
        if (toggleBtn) {
          const row = toggleBtn.closest('tr[data-sku]');
          if (row && row.dataset.sku) {
            this.toggleSkuActive(row.dataset.sku);
          }
          return;
        }
        const saveBtn = e.target.closest('.btn-row-save');
        if (saveBtn) {
          const row = saveBtn.closest('tr[data-sku]');
          if (row && row.dataset.sku) {
            this.saveSingleCatalogRow(row.dataset.sku);
          }
          return;
        }
      });

      // Auto-save on input change (typing or stepper)
      catalogTbody.addEventListener('change', (e) => {
        const input = e.target.closest('.input-catalog');
        if (input) {
          const row = input.closest('tr[data-sku]');
          if (row && row.dataset.sku) {
            this.saveSingleCatalogRow(row.dataset.sku, true); // silent auto-save
          }
        }
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

    // Global Configuration Actions
    const btnConfigSave = document.getElementById('btn-config-save');
    if (btnConfigSave) {
      btnConfigSave.addEventListener('click', () => this.saveUserConfig());
    }

    const btnConfigReset = document.getElementById('btn-config-reset');
    if (btnConfigReset) {
      btnConfigReset.addEventListener('click', () => this.resetUserConfig());
    }
  }

  loadUserConfig() {
    try {
      const saved = localStorage.getItem('mrp_user_settings');
      if (saved) {
        const cfg = JSON.parse(saved);
        if (cfg.safetyStock !== undefined) this.safetyStock = Number(cfg.safetyStock);
        if (cfg.defaultVdpDays) this.vdpDays = Number(cfg.defaultVdpDays);
        if (cfg.plannerName) this.plannerName = cfg.plannerName;
        if (cfg.warehouseName) this.warehouseName = cfg.warehouseName;
        if (cfg.currency) this.currency = cfg.currency;
        if (cfg.leadTimeHours) this.leadTimeHours = Number(cfg.leadTimeHours);
      }
    } catch (e) {
      console.warn('Error loading user config:', e);
    }
    this.renderConfigTab();
  }

  renderConfigTab() {
    const cfgSs = document.getElementById('cfg-safety-stock');
    if (cfgSs) cfgSs.value = this.safetyStock !== undefined ? this.safetyStock : 1;

    const cfgVdp = document.getElementById('cfg-default-vdp-days');
    if (cfgVdp) cfgVdp.value = (this.vdpDays || 60).toString();

    const cfgWh = document.getElementById('cfg-warehouse-name');
    if (cfgWh) cfgWh.value = this.warehouseName || 'Bodega 401 Central CODISA';

    const cfgPlanner = document.getElementById('cfg-planner-name');
    if (cfgPlanner) cfgPlanner.value = this.plannerName || 'Milton Sánchez Gutiérrez';

    const userChip = document.querySelector('.user-chip span');
    if (userChip && this.plannerName) userChip.innerText = this.plannerName;
  }

  saveUserConfig() {
    const cfgSs = document.getElementById('cfg-safety-stock');
    const cfgVdp = document.getElementById('cfg-default-vdp-days');
    const cfgWh = document.getElementById('cfg-warehouse-name');
    const cfgPlanner = document.getElementById('cfg-planner-name');

    const config = {
      safetyStock: cfgSs ? parseFloat(cfgSs.value) || 1 : 1,
      defaultVdpDays: cfgVdp ? parseInt(cfgVdp.value, 10) || 60 : 60,
      warehouseName: cfgWh ? cfgWh.value.trim() : 'Bodega 401 Central CODISA',
      plannerName: cfgPlanner ? cfgPlanner.value.trim() : 'Milton Sánchez Gutiérrez'
    };

    this.safetyStock = config.safetyStock;
    this.vdpDays = config.defaultVdpDays;
    this.warehouseName = config.warehouseName;
    this.plannerName = config.plannerName;

    localStorage.setItem('mrp_user_settings', JSON.stringify(config));

    // Persist to Server
    if (window.ApiClient && window.ApiClient.savePlanningConfig) {
      window.ApiClient.savePlanningConfig(config).catch(err => {
        console.warn('Sync config to server deferred:', err.message);
      });
    }

    // Update period filter in planner if changed
    const periodFilter = document.getElementById('period-filter');
    if (periodFilter) periodFilter.value = this.vdpDays.toString();

    // Update user chip
    const userChip = document.querySelector('.user-chip span');
    if (userChip && this.plannerName) userChip.innerText = this.plannerName;

    // Recalculate MRP
    this.recalculateAndRender();

    if (window.Toast) {
      window.Toast.show('✅ Configuración guardada y aplicada exitosamente en todo el sistema.', 'success');
    }
  }

  resetUserConfig() {
    localStorage.removeItem('mrp_user_settings');
    this.safetyStock = 1;
    this.leadTimeHours = 72;
    this.vdpDays = 60;
    this.warehouseName = 'Bodega 401 Central CODISA';
    this.plannerName = 'Milton Sánchez Gutiérrez';
    this.currency = 'CRC';

    this.renderConfigTab();
    this.recalculateAndRender();

    if (window.Toast) {
      window.Toast.show('Valores de configuración restaurados a los parámetros de fábrica.', 'info');
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

    if (tabId === 'catalog') {
      this.renderCatalogEditor();
    } else if (tabId === 'transit') {
      this.renderTransitTab();
    } else if (tabId === 'sync') {
      this.renderSyncTab();
    } else if (tabId === 'config') {
      this.renderConfigTab();
    }
  }

  updateDaySelectorUi(day) {
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
  }

  setExecutionDay(day) {
    this.executionDay = day;
    this.updateDaySelectorUi(day);
    this.loadDraftOverrides();
    const matrix = window.APP_CONFIG.planningMatrix[day] || window.APP_CONFIG.planningMatrix.Lunes;
    window.Toast.show(`Plan de pedidos actualizado para ${matrix.dayName} (Ingreso a Bodega: ${matrix.deliveryDay})`, 'info');
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
      // 1. Try fetching from Backend API (Planning calculation, Active transit orders, and Catalog overrides)
      if (window.ApiClient) {
        const [planRes, transitRes, overridesRes] = await Promise.allSettled([
          window.ApiClient.getPlanningCalculation(this.executionDay, this.safetyStock, this.vdpDays),
          window.ApiClient.getTransitOrders(),
          window.ApiClient.request ? window.ApiClient.request('/api/products/overrides') : Promise.resolve(null)
        ]);

        // Merge Catalog Overrides from Server + LocalStorage
        if (overridesRes.status === 'fulfilled' && overridesRes.value && overridesRes.value.overrides) {
          let localOv = {};
          try {
            localOv = JSON.parse(localStorage.getItem('codisa_catalog_overrides') || '{}');
          } catch(e) {}
          const mergedOv = { ...overridesRes.value.overrides, ...localOv };
          localStorage.setItem('codisa_catalog_overrides', JSON.stringify(mergedOv));
        }

        // Smart-Merge In-Transit Orders (Never wipe out local/initial orders with an empty server array)
        const serverOrders = (transitRes.status === 'fulfilled' && transitRes.value && Array.isArray(transitRes.value.orders)) ? transitRes.value.orders : [];
        let localOrders = [];
        try {
          localOrders = JSON.parse(localStorage.getItem('mrp_active_orders') || '[]');
        } catch(e) {}

        const orderMap = new Map();
        if (typeof INITIAL_ORDERS !== 'undefined' && Array.isArray(INITIAL_ORDERS)) {
          INITIAL_ORDERS.forEach(o => {
            const key = o ? (o.id || o.orderCode || o.orderNumber) : null;
            if (key) orderMap.set(key, o);
          });
        }
        if (Array.isArray(localOrders)) {
          localOrders.forEach(o => {
            const key = o ? (o.id || o.orderCode || o.orderNumber) : null;
            if (key) orderMap.set(key, o);
          });
        }
        if (Array.isArray(serverOrders)) {
          serverOrders.forEach(o => {
            const key = o ? (o.id || o.orderCode || o.orderNumber) : null;
            if (key) orderMap.set(key, o);
          });
        }

        this.activeOrders = Array.from(orderMap.values());
        localStorage.setItem('mrp_active_orders', JSON.stringify(this.activeOrders));

        if (planRes.status === 'fulfilled' && planRes.value && planRes.value.items) {
          this.items = planRes.value.items;
          this.loadCatalogOverrides();
          this.loadDraftOverrides();
          return;
        }
      }
    } catch (e) {
      console.warn('Backend fetch failed, falling back to local data.js:', e);
    }

    // Fallback active orders from localStorage or INITIAL_ORDERS if offline
    try {
      const savedOrders = JSON.parse(localStorage.getItem('mrp_active_orders') || '[]');
      const orderMap = new Map();
      if (typeof INITIAL_ORDERS !== 'undefined' && Array.isArray(INITIAL_ORDERS)) {
        INITIAL_ORDERS.forEach(o => {
          const key = o ? (o.id || o.orderCode || o.orderNumber) : null;
          if (key) orderMap.set(key, o);
        });
      }
      if (Array.isArray(savedOrders)) {
        savedOrders.forEach(o => {
          const key = o ? (o.id || o.orderCode || o.orderNumber) : null;
          if (key) orderMap.set(key, o);
        });
      }
      this.activeOrders = Array.from(orderMap.values());
    } catch(e) {}

    // Fallback to local data.js
    if (typeof INITIAL_PEDIDOS !== 'undefined' && Array.isArray(INITIAL_PEDIDOS)) {
      this.items = INITIAL_PEDIDOS.map(row => {
        const codeFrumusa = (row.code_frumusa || row.codeFrumusa || row['Codigo frumusa'] || '').toString().trim();
        const codeCountry = (row.code_country || row.codeCountry || row['Código country'] || '').toString().trim();
        const descText = (row.description || row.ARTICULO || row['Descripción'] || '').toString().trim();
        const skuKey = codeFrumusa || codeCountry || descText;

        const transitSaved = localStorage.getItem(`mrp_transit_${skuKey}`);
        const transit = transitSaved !== null ? Number(transitSaved) : Number(row.transit_qty || row.activeTransit || 0);

        const packMultiple = Number(row.pack_multiple || row.packMultiple || row['Múltiplo de pedido'] || 1);
        const minCoverage = Number(row.min_coverage_qty || row.minCoverageUnits || row.safety_stock_units || row['Cobertura minima'] || (packMultiple * 2));

        return {
          codeSku: skuKey,
          code_sku: skuKey,
          code_country: codeCountry,
          codeCountry: codeCountry,
          code_frumusa: codeFrumusa,
          codeFrumusa: codeFrumusa,
          description: descText,
          category: row.category || row.CATEGORIA || this.getProduceCategory(descText),
          stock_actual: Number(row.stock_actual !== undefined ? row.stock_actual : (row.stock !== undefined ? row.stock : (row['Stock'] || 0))),
          stock: Number(row.stock_actual !== undefined ? row.stock_actual : (row.stock !== undefined ? row.stock : (row['Stock'] || 0))),
          sales_period: Number(row.sales_period !== undefined ? row.sales_period : (row.ventas !== undefined ? row.ventas : (row['Ventas del período'] || 0))),
          sales_60d: Number(row.sales_60d || row.sales_period || 0),
          days_period: this.vdpDays || Number(row.days_period || row['Días del período'] || 60),
          unit_cost: Number(row.unit_cost !== undefined ? row.unit_cost : (row.cost !== undefined ? row.cost : (row['Costo unitario'] || 0))),
          unit_price: Number(row.unit_price || (row.unit_cost ? row.unit_cost * 1.35 : 0)),
          unit_eq: row.unit_eq || row.unit_fromusa || row.unit || 'UD',
          transit_qty: transit,
          activeTransit: transit,
          transit: transit,
          pack_multiple: packMultiple,
          packMultiple: packMultiple,
          min_coverage_qty: minCoverage,
          minCoverageUnits: minCoverage,
          safety_stock_units: minCoverage,
          safety_stock_days: Number(row.safety_stock_days || row['Covertura meta'] || 1),
          pedidoFinalOverride: null,
          is_active: row.is_active !== false && row.isActive !== false,
          isActive: row.is_active !== false && row.isActive !== false
        };
      });
      this.loadCatalogOverrides();
      this.loadDraftOverrides();
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
    const activeProducts = this.items.filter(prod => prod.is_active !== false && prod.isActive !== false);

    this.calculatedItems = activeProducts.map(prod => {
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

    // Update In-Transit Order Banner in Planning Tab
    const transitBanner = document.getElementById('active-transit-banner');
    const transitBannerText = document.getElementById('transit-banner-text');
    const btnDownloadExcel = document.getElementById('btn-banner-download-excel');

    if (transitBanner) {
      if (this.activeOrders && this.activeOrders.length > 0) {
        const latestOrder = this.activeOrders[0];
        transitBanner.style.display = 'flex';
        if (transitBannerText) {
          const costFormatted = window.AppFormatter ? window.AppFormatter.currency(latestOrder.totalCost || 0) : `₡${Math.round(latestOrder.totalCost || 0)}`;
          transitBannerText.innerHTML = `<strong>${this.activeOrders.length} Pedido(s) en Tránsito (72h):</strong> ${latestOrder.orderNumber || latestOrder.orderCode} (${latestOrder.totalItems || latestOrder.items.length} SKUs, ${latestOrder.totalBoxes || 0} cjas, ${costFormatted}). Ingreso: ${latestOrder.deliveryDay || '72h'}`;
        }
        if (btnDownloadExcel) {
          btnDownloadExcel.onclick = () => {
            this.downloadOrderXlsx(latestOrder.orderCode || latestOrder.orderNumber || latestOrder.id);
          };
        }
      } else {
        transitBanner.style.display = 'none';
      }
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
      if (prod.stock_actual === val && prod.stock === val) return;
      prod.stock_actual = val;
      prod.stock = val;
    } else if (type === 'transit') {
      if (prod.transit_qty === val && prod.transit === val) return;
      prod.transit_qty = val;
      prod.transit = val;
      localStorage.setItem(`mrp_transit_${sku}`, val);
    } else if (type === 'override') {
      if (prod.pedidoFinalOverride === val) return;
      prod.pedidoFinalOverride = val;
      this.saveDraftOverrides();
    }

    this.recalculateAndRender();
  }

  saveDraftOverrides() {
    try {
      const drafts = {};
      this.items.forEach(p => {
        if (p.pedidoFinalOverride !== null && p.pedidoFinalOverride !== undefined) {
          const skuKey = ((p.code_frumusa && p.code_frumusa.trim()) ? p.code_frumusa.trim() : (p.code_country ? p.code_country.trim() : (p.codeSku || ''))).toUpperCase();
          if (skuKey) drafts[skuKey] = p.pedidoFinalOverride;
          if (p.code_frumusa) drafts[p.code_frumusa.toString().trim().toUpperCase()] = p.pedidoFinalOverride;
          if (p.code_country) drafts[p.code_country.toString().trim().toUpperCase()] = p.pedidoFinalOverride;
          if (p.codeSku) drafts[p.codeSku.toString().trim().toUpperCase()] = p.pedidoFinalOverride;
        }
      });
      localStorage.setItem(`mrp_draft_overrides_${this.executionDay}`, JSON.stringify(drafts));
    } catch(e) {}
  }

  loadDraftOverrides() {
    try {
      const saved = localStorage.getItem(`mrp_draft_overrides_${this.executionDay}`);
      if (saved) {
        const drafts = JSON.parse(saved);
        this.items.forEach(p => {
          const skuKey = ((p.code_frumusa && p.code_frumusa.trim()) ? p.code_frumusa.trim() : (p.code_country ? p.code_country.trim() : (p.codeSku || ''))).toUpperCase();
          const k1 = (p.code_frumusa || p.codeFrumusa || '').toString().trim().toUpperCase();
          const k2 = (p.code_country || p.codeCountry || '').toString().trim().toUpperCase();
          const k3 = (p.codeSku || '').toString().trim().toUpperCase();

          const val = drafts[skuKey] !== undefined ? drafts[skuKey] : 
                      (k1 && drafts[k1] !== undefined ? drafts[k1] : 
                      (k3 && drafts[k3] !== undefined ? drafts[k3] : 
                      (k2 && drafts[k2] !== undefined ? drafts[k2] : undefined)));

          if (val !== undefined) {
            p.pedidoFinalOverride = val;
          }
        });
      }
    } catch(e) {}
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
    this.saveDraftOverrides();

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
    this.saveDraftOverrides();

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
      orderNumber: `PED-${this.executionDay.slice(0, 3).toUpperCase()}-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(this.activeOrders.length + 1).padStart(2, '0')}`,
      executionDay: this.executionDay,
      day: this.executionDay,
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

    // 1. Add to Active Orders in Memory and browser localStorage
    this.activeOrders.unshift(newOrder);
    localStorage.setItem('mrp_active_orders', JSON.stringify(this.activeOrders));

    // 2. Transfer approved order to transit for matching products
    itemsToOrder.forEach(orderItem => {
      const itemKey = (orderItem.codeSku || orderItem.codeFrumusa || orderItem.codeCountry || '').toString().trim().toUpperCase();
      const prod = this.items.find(p => {
        const k1 = (p.code_frumusa || p.codeFrumusa || '').toString().trim().toUpperCase();
        const k2 = (p.code_country || p.codeCountry || '').toString().trim().toUpperCase();
        const k3 = (p.codeSku || '').toString().trim().toUpperCase();
        return k1 === itemKey || k2 === itemKey || k3 === itemKey;
      });
      if (prod) {
        prod.transit_qty = (Number(prod.transit_qty || 0)) + orderItem.finalQty;
        prod.transit = prod.transit_qty;
        prod.activeTransit = prod.transit_qty;
        localStorage.setItem(`mrp_transit_${itemKey}`, prod.transit_qty);
        prod.pedidoFinalOverride = null; // Clear override
      }
    });

    // Clear draft overrides for this day
    localStorage.removeItem(`mrp_draft_overrides_${this.executionDay}`);

    this.renderTransitTab();

    // 3. Persist to Backend Server & Disk
    if (window.ApiClient && window.ApiClient.approveOrder) {
      window.ApiClient.approveOrder({
        executionDay: this.executionDay,
        items: itemsToOrder,
        order: newOrder
      }).then(res => {
        if (res && res.order) {
          console.log('✅ Orden guardada en disco del servidor:', res.order.id);
        }
      }).catch(err => console.warn('Backend sync failed (running standalone):', err.message));
    }

    // 4. Automatic Corporate Excel (.xlsx) Download
    const excelFilename = `Pedido_Final_${this.executionDay}_${now.toISOString().slice(0, 10)}.xlsx`;
    const doDownloadExcel = () => {
      window.ExcelExporter.exportOrderToXlsx({
        executionDay: this.executionDay,
        deliveryDay: matrix.deliveryDay,
        orderCode,
        items: itemsToOrder,
        totalCost: grandTotalCost,
        totalUnits: grandTotalUnits,
        totalBoxes: grandTotalBoxes
      }, excelFilename);
    };

    doDownloadExcel();

    // 5. Open Dedicated Server Sync & Registration Modal
    if (window.ModalManager && window.ModalManager.showOrderSyncProgress) {
      window.ModalManager.showOrderSyncProgress(
        newOrder,
        () => {
          // Callback: Navegar a pestaña de Tránsito
          this.switchTab('transit');
          setTimeout(() => {
            const orderCard = document.querySelector(`.transit-order-card[data-order-id="${orderCode}"]`);
            if (orderCard) {
              orderCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
              orderCard.style.outline = '2px solid #10b981';
              setTimeout(() => { orderCard.style.outline = ''; }, 3000);
            }
          }, 300);
        },
        () => {
          // Callback: Re-descargar Excel
          doDownloadExcel();
          window.Toast.show('Descargando archivo Excel nuevamente...', 'info');
        }
      );
    } else {
      window.Toast.show(`¡Orden ${orderCode} registrada y guardada en el servidor!`, 'success', 5000);
    }

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
    const grid = document.getElementById('transit-orders-list') || document.getElementById('transit-orders-grid');
    if (!grid) return;

    if (!this.activeOrders || this.activeOrders.length === 0) {
      grid.innerHTML = `
        <div class="empty-transit-state" style="grid-column: 1 / -1; padding: 40px; text-align: center;">
          <i class="fa-solid fa-truck-ramp-box" style="font-size: 2.5rem; color: var(--text-dim); margin-bottom: 12px;"></i>
          <p style="font-size: 1.1rem; font-weight: 600;">No hay órdenes aprobadas actualmente en tránsito.</p>
          <span style="font-size: 0.85rem; color: var(--text-dim);">Cuando apruebes un pedido en el Planeador, aparecerá aquí como tránsito activo de 72h.</span>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.activeOrders.map(order => {
      const orderCode = order.orderCode || order.orderNumber || order.id;
      return `
        <div class="transit-card" data-order-id="${order.id}">
          <div class="transit-card-header">
            <div class="transit-card-title">
              <i class="fa-solid fa-receipt text-primary"></i>
              <strong class="font-mono">${orderCode}</strong>
            </div>
            <span class="badge-day">${order.executionDay || order.day}</span>
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
          <div class="transit-card-footer" style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; flex-wrap: wrap;">
            <button class="btn-primary btn-small" onclick="window.MrpAppInstance.loadOrderIntoPlanning('${order.id}')" title="Cargar y revisar estos ${order.totalItems} artículos en la mesa de pedidos">
              <i class="fa-solid fa-pen-to-square"></i> Cargar en Mesa de Pedidos
            </button>
            <button class="btn-secondary btn-small" onclick="window.MrpAppInstance.downloadOrderXlsx('${orderCode}')" title="Descargar Excel de la orden">
              <i class="fa-solid fa-file-excel"></i> Excel
            </button>
            <button class="btn-danger btn-small" onclick="window.MrpAppInstance.deleteTransitOrder('${order.id}')" title="Eliminar orden del tránsito">
              <i class="fa-solid fa-trash"></i> Eliminar
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  loadOrderIntoPlanning(orderId) {
    const order = (this.activeOrders || []).find(o => o.id === orderId || o.orderCode === orderId || o.orderNumber === orderId);
    if (!order || !order.items) {
      window.Toast.show('No se encontró el pedido a cargar.', 'warning');
      return;
    }

    // Set execution day
    const day = order.executionDay || order.day || 'Jueves';
    this.executionDay = day;
    this.updateDaySelectorUi(day);

    // Apply items as overrides in table
    const drafts = {};
    order.items.forEach(item => {
      const sku = (item.codeSku || item.codeFrumusa || item.codeCountry || '').toString().trim();
      const qty = Number(item.quantity || item.finalQty || 0);

      const prod = this.items.find(p => (
        (p.code_frumusa && p.code_frumusa.toString() === sku) ||
        (p.codeFrumusa && p.codeFrumusa.toString() === sku) ||
        (p.code_country && p.code_country.toString() === sku) ||
        (p.codeSku && p.codeSku.toString() === sku)
      ));

      if (prod) {
        prod.pedidoFinalOverride = qty;
      }
      if (sku) drafts[sku] = qty;
    });

    localStorage.setItem(`mrp_draft_overrides_${day}`, JSON.stringify(drafts));

    // Switch to planning tab and filter by 'to-order' so user sees exactly their 39 items
    this.switchTab('planning');
    this.activeFilter = 'to-order';
    document.querySelectorAll('.filter-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.filter === 'to-order');
    });

    this.recalculateAndRender();
    window.Toast.show(`¡Pedido ${order.orderNumber || order.orderCode} cargado en la mesa de pedidos! (${order.items.length} artículos listos para revisar y autorizar).`, 'success', 6000);
  }

  async clearAllTransit() {
    if (!confirm('¿Estás seguro de que deseas eliminar TODOS los pedidos en tránsito del servidor? Esta acción liberará el stock en tránsito.')) {
      return;
    }
    try {
      if (window.ApiClient) {
        await window.ApiClient.clearAllTransitOrders().catch(() => {});
      }
      this.activeOrders = [];
      localStorage.removeItem('mrp_active_orders');
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('mrp_transit_')) localStorage.removeItem(k);
      });
      this.items.forEach(p => {
        p.transit_qty = 0;
        p.activeTransit = 0;
        p.transit = 0;
      });
      this.renderTransitTab();
      this.recalculateAndRender();
      window.Toast.show('Todos los pedidos en tránsito han sido eliminados del servidor.', 'success');
    } catch(e) {
      window.Toast.show('Error al eliminar pedidos en tránsito: ' + e.message, 'error');
    }
  }

  async deleteTransitOrder(orderId) {
    if (!confirm(`¿Deseas eliminar la orden ${orderId} del tránsito?`)) return;
    try {
      if (window.ApiClient) {
        await window.ApiClient.deleteTransitOrder(orderId).catch(() => {});
      }
      const idx = this.activeOrders.findIndex(o => o.id === orderId || o.orderCode === orderId || o.orderNumber === orderId);
      if (idx !== -1) {
        const [deleted] = this.activeOrders.splice(idx, 1);
        if (deleted && deleted.items) {
          deleted.items.forEach(item => {
            localStorage.removeItem(`mrp_transit_${item.codeSku}`);
          });
        }
      }
      localStorage.setItem('mrp_active_orders', JSON.stringify(this.activeOrders));
      this.renderTransitTab();
      this.recalculateAndRender();
      window.Toast.show(`Orden ${orderId} eliminada del tránsito.`, 'success');
    } catch(e) {
      window.Toast.show('Error al eliminar orden: ' + e.message, 'error');
    }
  }

  renderSyncTab() {
    // Injected with sync status info
  }

  downloadOrderXlsx(orderCode) {
    const order = this.activeOrders.find(o => o.orderCode === orderCode || o.orderNumber === orderCode || o.id === orderCode);
    if (!order) return;

    window.ExcelExporter.exportOrderToXlsx({
      executionDay: order.executionDay || order.day,
      deliveryDay: order.deliveryDay,
      orderCode: order.orderCode || order.orderNumber || order.id,
      items: order.items,
      totalCost: order.totalCost,
      totalUnits: order.totalUnits,
      totalBoxes: order.totalBoxes
    }, `${orderCode}.xlsx`);

    window.Toast.show(`Descargando archivo Excel para ${orderCode}...`, 'info');
  }

  loadCatalogOverrides() {
    try {
      const saved = localStorage.getItem('codisa_catalog_overrides');
      if (saved) {
        const overrides = JSON.parse(saved);
        this.items.forEach(item => {
          const skuKey = ((item.code_frumusa && item.code_frumusa.trim()) ? item.code_frumusa.trim() : (item.code_country ? item.code_country.trim() : (item.codeSku || ''))).toUpperCase();
          const k1 = (item.code_frumusa || item.codeFrumusa || '').toString().trim().toUpperCase();
          const k2 = (item.code_country || item.codeCountry || '').toString().trim().toUpperCase();
          const k3 = (item.codeSku || '').toString().trim().toUpperCase();
          
          const ov = overrides[skuKey] || (k1 ? overrides[k1] : null) || (k3 ? overrides[k3] : null) || overrides[k2];
          if (ov) {
            if (ov.is_active !== undefined) {
              item.is_active = Boolean(ov.is_active);
              item.isActive = Boolean(ov.is_active);
            }
            if (ov.pack_multiple !== undefined) {
              item.pack_multiple = Number(ov.pack_multiple);
              item.packMultiple = Number(ov.pack_multiple);
            }
            if (ov.min_coverage_qty !== undefined) {
              item.min_coverage_qty = Number(ov.min_coverage_qty);
              item.minCoverageUnits = Number(ov.min_coverage_qty);
              item.safety_stock_units = Number(ov.min_coverage_qty);
            }
            if (ov.code_frumusa !== undefined) {
              item.code_frumusa = ov.code_frumusa;
              item.codeFrumusa = ov.code_frumusa;
            }
            if (ov.code_country !== undefined) {
              item.code_country = ov.code_country;
              item.codeCountry = ov.code_country;
            }
            if (ov.unit_eq) item.unit_eq = ov.unit_eq;
            if (ov.description) item.description = ov.description;
          }
        });
      }
    } catch(e) {
      console.warn('Error al cargar overrides de catálogo:', e.message);
    }
  }

  toggleSkuActive(skuKey) {
    const cleanSku = (skuKey || '').toString().trim().toUpperCase();
    const item = this.items.find(i => {
      const k = ((i.code_frumusa && i.code_frumusa.trim()) ? i.code_frumusa.trim() : (i.code_country ? i.code_country.trim() : (i.codeSku || ''))).toUpperCase();
      return k === cleanSku;
    }) || this.items.find(i => {
      const k1 = (i.code_frumusa || i.codeFrumusa || '').toString().trim().toUpperCase();
      const k2 = (i.code_country || i.codeCountry || '').toString().trim().toUpperCase();
      const k3 = (i.codeSku || '').toString().trim().toUpperCase();
      return k1 === cleanSku || k3 === cleanSku || k2 === cleanSku;
    });

    if (!item) return;

    const currentStatus = item.is_active !== false && item.isActive !== false;
    const newStatus = !currentStatus;

    item.is_active = newStatus;
    item.isActive = newStatus;

    // 1. Save to overrides in localStorage (Instant client-side cache)
    let overrides = {};
    try {
      overrides = JSON.parse(localStorage.getItem('codisa_catalog_overrides') || '{}');
    } catch(e) {}

    const exactKey = ((item.code_frumusa && item.code_frumusa.trim()) ? item.code_frumusa.trim() : (item.code_country ? item.code_country.trim() : (item.codeSku || skuKey))).toUpperCase();
    overrides[exactKey] = {
      ...(overrides[exactKey] || {}),
      is_active: newStatus
    };
    localStorage.setItem('codisa_catalog_overrides', JSON.stringify(overrides));

    // 2. Persist to Backend Server & Disk
    if (window.ApiClient) {
      if (window.ApiClient.request) {
        window.ApiClient.request('/api/products/overrides', {
          method: 'POST',
          body: JSON.stringify({ overrides: { [exactKey]: { is_active: newStatus } } })
        }).catch(() => {});
      }
      if (window.ApiClient.toggleProductActive) {
        window.ApiClient.toggleProductActive(exactKey, newStatus).catch(err => {
          console.warn('Sync toggle to server deferred:', err.message);
        });
      }
    }

    this.renderCatalogEditor();
    this.recalculateAndRender();

    if (window.Toast) {
      window.Toast.show(
        `Artículo ${item.description || skuKey} marcado como ${newStatus ? 'ACTIVO (Visible en MRP)' : 'DESACTIVADO (Oculto en MRP)'}.`,
        newStatus ? 'success' : 'info'
      );
    }
  }

  renderCatalogEditor() {
    const tbody = document.getElementById('catalog-table-body');
    if (!tbody) return;

    const q = (this.catalogSearchQuery || '').toLowerCase().trim();
    const cat = this.catalogSelectedCategory || 'all';
    const status = this.catalogSelectedStatus || 'all';

    const filtered = this.items.filter(item => {
      const sku1 = (item.code_frumusa || item.codeFrumusa || '').toString().toLowerCase();
      const sku2 = (item.code_country || item.codeCountry || item.codeSku || '').toString().toLowerCase();
      const desc = (item.description || item.ARTICULO || '').toString().toLowerCase();
      const matchQuery = !q || sku1.includes(q) || sku2.includes(q) || desc.includes(q);
      const matchCat = cat === 'all' || item.category === cat;
      const isActive = item.is_active !== false && item.isActive !== false;
      const matchStatus = status === 'all' || (status === 'active' && isActive) || (status === 'inactive' && !isActive);
      return matchQuery && matchCat && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="table-empty-state" style="text-align: center; padding: 30px;">
            <i class="fa-solid fa-box-open" style="font-size: 2rem; color: var(--text-dim); margin-bottom: 8px;"></i>
            <p>No se encontraron artículos en el maestro con los filtros seleccionados.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(item => {
      const skuKey = ((item.code_frumusa && item.code_frumusa.trim()) ? item.code_frumusa.trim() : (item.code_country ? item.code_country.trim() : (item.codeSku || ''))).toString().trim();
      const frumusaVal = item.code_frumusa || item.codeFrumusa || '';
      const countryVal = item.code_country || item.codeCountry || item.codeSku || '';
      const descVal = item.description || item.ARTICULO || '';
      const unitVal = item.unit_eq || item.UNIDAD_EQ || 'UD';
      const packVal = Number(item.pack_multiple || item.packMultiple || 1);
      const minQty = Math.round(Number(item.min_coverage_qty || item.minCoverageUnits || item.safety_stock_units || packVal || 1));
      const isActive = item.is_active !== false && item.isActive !== false;

      return `
        <tr data-sku="${skuKey}" class="${!isActive ? 'catalog-row-inactive' : ''}">
          <td class="text-center">
            <button type="button" class="btn-status-toggle ${isActive ? 'status-active' : 'status-inactive'}" 
                    title="${isActive ? 'Artículo Activo en MRP (Clic para desactivar)' : 'Artículo Desactivado (Clic para activar)'}">
              <i class="fa-solid ${isActive ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
              <span>${isActive ? 'Activo' : 'Inactivo'}</span>
            </button>
          </td>
          <td>
            <input type="text" class="input-catalog font-mono field-frumusa" data-sku="${skuKey}" value="${frumusaVal}" placeholder="-" title="Código Frumusa (Proveedor)">
          </td>
          <td>
            <input type="text" class="input-catalog font-mono field-country" data-sku="${skuKey}" value="${countryVal}" title="Código Country (CODISA)">
          </td>
          <td>
            <input type="text" class="input-catalog field-desc" data-sku="${skuKey}" value="${descVal}" title="Descripción del Artículo">
          </td>
          <td class="text-center">
            <input type="text" class="input-catalog font-mono text-center field-unit" data-sku="${skuKey}" value="${unitVal}" style="max-width: 60px;" title="Unidad de Medida">
          </td>
          <td class="text-center">
            <input type="number" step="any" min="0.1" class="input-catalog font-mono text-center field-pack" data-sku="${skuKey}" value="${packVal}" style="max-width: 80px;" title="Bulto: Contenido total por Caja/Saco/Empaque">
          </td>
          <td class="text-center">
            <input type="number" step="1" min="0" class="input-catalog font-mono text-center field-ss" data-sku="${skuKey}" value="${minQty}" style="max-width: 90px;" title="Cobertura Mínima en Unidades (Stock de Seguridad requerido)">
          </td>
          <td class="text-center">
            <button class="btn-row-save" title="Guardar cambios de esta fila">
              <i class="fa-solid fa-check"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  saveSingleCatalogRow(skuKey, silent = false) {
    const row = document.querySelector(`#catalog-table-body tr[data-sku="${skuKey}"]`);
    if (!row) return;

    const frumusa = row.querySelector('.field-frumusa').value.trim();
    const country = row.querySelector('.field-country').value.trim();
    const desc = row.querySelector('.field-desc').value.trim();
    const unit = row.querySelector('.field-unit').value.trim();
    const pack = parseFloat(row.querySelector('.field-pack').value) || 1;
    const minQty = Math.round(parseFloat(row.querySelector('.field-ss').value) || 0);

    const cleanSku = (skuKey || '').toString().trim().toUpperCase();
    const item = this.items.find(i => {
      const k = ((i.code_frumusa && i.code_frumusa.trim()) ? i.code_frumusa.trim() : (i.code_country ? i.code_country.trim() : (i.codeSku || ''))).toUpperCase();
      return k === cleanSku;
    }) || this.items.find(i => (
      (i.code_frumusa && i.code_frumusa.toString().toUpperCase() === cleanSku) ||
      (i.code_country && i.code_country.toString().toUpperCase() === cleanSku) ||
      (i.codeSku && i.codeSku.toString().toUpperCase() === cleanSku)
    ));

    const isActive = item ? (item.is_active !== false && item.isActive !== false) : true;

    // 1. Save to LocalStorage
    let overrides = {};
    try {
      overrides = JSON.parse(localStorage.getItem('codisa_catalog_overrides') || '{}');
    } catch(e) {}

    const exactKey = ((frumusa || country || skuKey)).toUpperCase();
    const overrideObj = {
      is_active: isActive,
      code_frumusa: frumusa,
      code_country: country,
      description: desc,
      unit_eq: unit,
      pack_multiple: pack,
      min_coverage_qty: minQty,
      safety_stock_units: minQty
    };
    overrides[exactKey] = overrideObj;

    localStorage.setItem('codisa_catalog_overrides', JSON.stringify(overrides));

    // 2. Persist to Backend Server & Disk via dedicated overrides endpoint
    if (window.ApiClient) {
      if (window.ApiClient.request) {
        window.ApiClient.request('/api/products/overrides', {
          method: 'POST',
          body: JSON.stringify({ overrides: { [exactKey]: overrideObj } })
        }).catch(() => {});
      }
      if (window.ApiClient.updateProduct) {
        window.ApiClient.updateProduct(exactKey, {
          isActive,
          codeFrumusa: frumusa,
          codeCountry: country,
          description: desc,
          unitEq: unit,
          packMultiple: pack,
          minCoverageQty: minQty
        }).catch(err => {
          console.warn('Sync row to server deferred:', err.message);
        });
      }
    }

    // Update in-memory item
    if (item) {
      item.code_frumusa = frumusa;
      item.codeFrumusa = frumusa;
      item.code_country = country;
      item.codeCountry = country;
      item.description = desc;
      item.unit_eq = unit;
      item.pack_multiple = pack;
      item.packMultiple = pack;
      item.min_coverage_qty = minQty;
      item.minCoverageUnits = minQty;
      item.safety_stock_units = minQty;
    }

    this.recalculateAndRender();
    if (!silent && window.Toast) {
      window.Toast.show(`Artículo ${desc || skuKey} guardado en el maestro (Bulto: ${pack} | Cobertura Mín: ${minQty}).`, 'success');
    }
  }

  saveAllCatalogChanges() {
    let overrides = {};
    try {
      overrides = JSON.parse(localStorage.getItem('codisa_catalog_overrides') || '{}');
    } catch(e) {}

    const rows = document.querySelectorAll('#catalog-table-body tr[data-sku]');
    rows.forEach(row => {
      const skuKey = row.dataset.sku;
      const frumusa = row.querySelector('.field-frumusa').value.trim();
      const country = row.querySelector('.field-country').value.trim();
      const desc = row.querySelector('.field-desc').value.trim();
      const unit = row.querySelector('.field-unit').value.trim();
      const pack = parseFloat(row.querySelector('.field-pack').value) || 1;
      const minQty = Math.round(parseFloat(row.querySelector('.field-ss').value) || 0);

      const cleanSku = (skuKey || '').toString().trim().toUpperCase();
      const item = this.items.find(i => {
        const k = ((i.code_frumusa && i.code_frumusa.trim()) ? i.code_frumusa.trim() : (i.code_country ? i.code_country.trim() : (i.codeSku || ''))).toUpperCase();
        return k === cleanSku;
      }) || this.items.find(i => (
        (i.code_frumusa && i.code_frumusa.toString().toUpperCase() === cleanSku) ||
        (i.code_country && i.code_country.toString().toUpperCase() === cleanSku) ||
        (i.codeSku && i.codeSku.toString().toUpperCase() === cleanSku)
      ));

      const isActive = item ? (item.is_active !== false && item.isActive !== false) : true;
      const exactKey = (frumusa || country || skuKey).toUpperCase();

      overrides[exactKey] = {
        is_active: isActive,
        code_frumusa: frumusa,
        code_country: country,
        description: desc,
        unit_eq: unit,
        pack_multiple: pack,
        min_coverage_qty: minQty,
        safety_stock_units: minQty
      };

      if (item) {
        item.code_frumusa = frumusa;
        item.codeFrumusa = frumusa;
        item.code_country = country;
        item.codeCountry = country;
        item.description = desc;
        item.unit_eq = unit;
        item.pack_multiple = pack;
        item.packMultiple = pack;
        item.min_coverage_qty = minQty;
        item.minCoverageUnits = minQty;
        item.safety_stock_units = minQty;
      }
    });

    // 1. Save to LocalStorage
    localStorage.setItem('codisa_catalog_overrides', JSON.stringify(overrides));

    // 2. Persist to Backend Server & Disk via dedicated overrides endpoint
    if (window.ApiClient) {
      if (window.ApiClient.request) {
        window.ApiClient.request('/api/products/overrides', {
          method: 'POST',
          body: JSON.stringify({ overrides })
        }).catch(() => {});
      }
      if (window.ApiClient.batchUpdateProducts) {
        window.ApiClient.batchUpdateProducts(overrides).catch(err => {
          console.warn('Sync batch update to server deferred:', err.message);
        });
      }
    }

    this.recalculateAndRender();
    window.Toast.show('✅ Todos los parámetros del Maestro de Artículos han sido guardados con éxito.', 'success');
  }

  resetCatalogToFactory() {
    if (confirm('¿Deseas restablecer todos los parámetros del maestro a los valores de fábrica?')) {
      localStorage.removeItem('codisa_catalog_overrides');
      window.location.reload();
    }
  }
}

// Instantiate and start app
document.addEventListener('DOMContentLoaded', () => {
  window.MrpAppInstance = new MrpApp();
  window.App = window.MrpAppInstance;
  window.MrpAppInstance.init();
});
