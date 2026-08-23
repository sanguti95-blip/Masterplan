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
    } else if (tabId === 'catalog') {
      this.renderCatalogEditor();
    } else if (tabId === 'transit') {
      this.renderTransitTab();
    } else if (tabId === 'sync') {
      this.renderSyncTab();
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
      // 1. Try fetching from Backend API
      if (window.ApiClient) {
        const [planRes, transitRes] = await Promise.allSettled([
          window.ApiClient.getPlanningCalculation(this.executionDay, this.safetyStock, this.vdpDays),
          window.ApiClient.getTransitOrders()
        ]);

        if (planRes.status === 'fulfilled' && planRes.value && planRes.value.items) {
          this.items = planRes.value.items;
          if (transitRes.status === 'fulfilled' && transitRes.value && transitRes.value.orders) {
            this.activeOrders = transitRes.value.orders;
          }
          this.loadCatalogOverrides();
          return;
        }
      }
    } catch (e) {
      console.warn('Backend fetch failed, falling back to local data.js:', e);
    }

    // Fallback to local data.js
    if (typeof INITIAL_PEDIDOS !== 'undefined' && typeof INITIAL_DATA !== 'undefined') {
      const dataByNoArti = new Map();
      const dataByDesc = new Map();
      INITIAL_DATA.forEach(row => {
        if (row.NO_ARTI !== undefined && row.NO_ARTI !== null) {
          dataByNoArti.set(row.NO_ARTI.toString().trim().toUpperCase(), row);
        }
        if (row.ARTICULO) {
          dataByDesc.set(row.ARTICULO.toString().trim().toUpperCase(), row);
        }
      });

      this.items = INITIAL_PEDIDOS
        .filter(row => row && ((row['Codigo frumusa'] !== undefined && row['Codigo frumusa'] !== '') || (row['Código country'] !== undefined && row['Código country'] !== '') || row['Descripción']))
        .map(row => {
        const codeFrumusa = (row['Codigo frumusa'] !== undefined ? row['Codigo frumusa'] : '').toString().trim();
        const codeCountry = (row['Código country'] !== undefined ? row['Código country'] : '').toString().trim();
        const desc = (row['Descripción'] || '').toString().trim().toUpperCase();

        let match = (codeFrumusa ? dataByNoArti.get(codeFrumusa.toUpperCase()) : null) ||
                    (codeCountry ? dataByNoArti.get(codeCountry.toUpperCase()) : null) ||
                    (desc ? dataByDesc.get(desc) : null);

        if (!match && desc) {
          for (const [d, r] of dataByDesc.entries()) {
            if (desc.includes(d) || d.includes(desc) || (desc.split(' ')[0] === d.split(' ')[0] && desc.length > 3)) {
              match = r;
              break;
            }
          }
        }

        let stock = Number(row['Stock'] || 0);
        if (match && match['SALDO_ACTUAL'] !== undefined) stock = Number(match['SALDO_ACTUAL']);

        let sales = Number(row['Ventas del período'] || 0);
        if (match && match['CANTIDAD'] !== undefined) sales = Number(match['CANTIDAD']);

        let cost = 0;
        if (match && Number(match['COSTO_UNITARIO']) > 0) {
          cost = Number(match['COSTO_UNITARIO']);
        } else if (Number(row['Costo unitario'] || row['Costo'] || 0) > 0) {
          cost = Number(row['Costo unitario'] || row['Costo']);
        } else {
          const origFinal = Number(row['Pedido sugerido'] || row['PEDIDO FINAL'] || 0);
          const origCost = Number(row['Costo de pedido'] || 0);
          if (origFinal > 0 && origCost > 0) cost = origCost / origFinal;
        }

        const transitSaved = localStorage.getItem(`mrp_transit_${codeFrumusa || codeCountry}`);
        const transit = transitSaved !== null ? Number(transitSaved) : Number(row['Transito'] || 0);

        const descText = row['Descripción'] || (match ? match['ARTICULO'] : '');
        const cat = row['Categoría'] || (match ? match['CATEGORIA'] : null) || this.getProduceCategory(descText);
        const packMultiple = Number(row['Múltiplo de pedido'] || 1);
        const minCoverage = Number(row['Cobertura minima'] || row['Covertura meta'] || (packMultiple * 6));

        return {
          code_country: codeCountry,
          code_frumusa: codeFrumusa,
          description: descText,
          category: cat,
          stock_actual: stock,
          sales_period: sales,
          days_period: this.vdpDays || Number(row['Días del período'] || 60),
          unit_cost: cost,
          unit_price: match ? Number(match['PRECIO'] || 0) : cost * 1.35,
          transit_qty: transit,
          pack_multiple: packMultiple,
          min_coverage_qty: minCoverage,
          safety_stock_units: minCoverage,
          safety_stock_days: Number(row['Covertura meta'] || 1),
          pedidoFinalOverride: null
        };
      });
      this.loadCatalogOverrides();
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
          <div class="transit-card-footer" style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px;">
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

  async clearAllTransit() {
    if (!confirm('¿Estás seguro de que deseas eliminar TODOS los pedidos en tránsito del servidor? Esta acción liberará el stock en tránsito.')) {
      return;
    }
    try {
      if (window.ApiClient) {
        await window.ApiClient.clearAllTransitOrders();
      }
      this.activeOrders = [];
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
        await window.ApiClient.deleteTransitOrder(orderId);
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
          const k1 = (item.code_frumusa || item.codeFrumusa || '').toString().trim().toUpperCase();
          const k2 = (item.code_country || item.codeCountry || '').toString().trim().toUpperCase();
          const k3 = (item.codeSku || '').toString().trim().toUpperCase();
          const ov = overrides[k1] || overrides[k2] || overrides[k3];
          if (ov) {
            if (ov.pack_multiple !== undefined) {
              item.pack_multiple = Number(ov.pack_multiple);
              item.packMultiple = Number(ov.pack_multiple);
            }
            if (ov.min_coverage_qty !== undefined) {
              item.min_coverage_qty = Number(ov.min_coverage_qty);
              item.minCoverageUnits = Number(ov.min_coverage_qty);
              item.safety_stock_units = Number(ov.min_coverage_qty);
            }
            if (ov.code_frumusa) {
              item.code_frumusa = ov.code_frumusa;
              item.codeFrumusa = ov.code_frumusa;
            }
            if (ov.code_country) {
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

  renderCatalogEditor() {
    const tbody = document.getElementById('catalog-table-body');
    if (!tbody) return;

    const q = (this.catalogSearchQuery || '').toLowerCase().trim();
    const cat = this.catalogSelectedCategory || 'all';

    const filtered = this.items.filter(item => {
      const sku1 = (item.code_frumusa || item.codeFrumusa || '').toString().toLowerCase();
      const sku2 = (item.code_country || item.codeCountry || item.codeSku || '').toString().toLowerCase();
      const desc = (item.description || item.ARTICULO || '').toString().toLowerCase();
      const matchQuery = !q || sku1.includes(q) || sku2.includes(q) || desc.includes(q);
      const matchCat = cat === 'all' || item.category === cat;
      return matchQuery && matchCat;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="table-empty-state" style="text-align: center; padding: 30px;">
            <i class="fa-solid fa-box-open" style="font-size: 2rem; color: var(--text-dim); margin-bottom: 8px;"></i>
            <p>No se encontraron artículos en el maestro con los filtros seleccionados.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(item => {
      const skuKey = (item.code_frumusa || item.codeFrumusa || item.code_country || item.codeCountry || item.codeSku || '').toString().trim();
      const frumusaVal = item.code_frumusa || item.codeFrumusa || item.codeSku || '';
      const countryVal = item.code_country || item.codeCountry || item.codeSku || '';
      const descVal = item.description || item.ARTICULO || '';
      const unitVal = item.unit_eq || item.UNIDAD_EQ || 'UD';
      const packVal = Number(item.pack_multiple || item.packMultiple || 1);
      const minQty = Math.round(Number(item.min_coverage_qty || item.minCoverageUnits || item.safety_stock_units || packVal || 1));
      return `
        <tr data-sku="${skuKey}">
          <td>
            <input type="text" class="input-catalog font-mono field-frumusa" data-sku="${skuKey}" value="${frumusaVal}" title="Código Frumusa (Proveedor)">
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
            <input type="number" step="any" min="1" class="input-catalog font-mono text-center field-pack" data-sku="${skuKey}" value="${packVal}" style="max-width: 80px;" title="Unidades por Bulto / Caja">
          </td>
          <td class="text-center">
            <input type="number" step="1" min="0" class="input-catalog font-mono text-center field-ss" data-sku="${skuKey}" value="${minQty}" style="max-width: 90px;" title="Cobertura Mínima en Unidades (Stock de Seguridad requerido)">
          </td>
          <td class="text-center">
            <button class="btn-row-save" onclick="window.MrpAppInstance.saveSingleCatalogRow('${skuKey}')" title="Guardar fila">
              <i class="fa-solid fa-check"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  saveSingleCatalogRow(skuKey) {
    const row = document.querySelector(`#catalog-table-body tr[data-sku="${skuKey}"]`);
    if (!row) return;

    const frumusa = row.querySelector('.field-frumusa').value.trim();
    const country = row.querySelector('.field-country').value.trim();
    const desc = row.querySelector('.field-desc').value.trim();
    const unit = row.querySelector('.field-unit').value.trim();
    const pack = parseFloat(row.querySelector('.field-pack').value) || 1;
    const minQty = Math.round(parseFloat(row.querySelector('.field-ss').value) || 0);

    let overrides = {};
    try {
      overrides = JSON.parse(localStorage.getItem('codisa_catalog_overrides') || '{}');
    } catch(e) {}

    overrides[skuKey.toUpperCase()] = {
      code_frumusa: frumusa,
      code_country: country,
      description: desc,
      unit_eq: unit,
      pack_multiple: pack,
      min_coverage_qty: minQty,
      safety_stock_units: minQty
    };

    localStorage.setItem('codisa_catalog_overrides', JSON.stringify(overrides));

    // Update in-memory item
    const item = this.items.find(i => (
      i.code_frumusa === skuKey || i.codeFrumusa === skuKey || 
      i.code_country === skuKey || i.codeCountry === skuKey || 
      i.codeSku === skuKey
    ));
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
    window.Toast.show(`Artículo ${desc || skuKey} guardado en el maestro (Cobertura Mínima: ${minQty} und).`, 'success');
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

      overrides[skuKey.toUpperCase()] = {
        code_frumusa: frumusa,
        code_country: country,
        description: desc,
        unit_eq: unit,
        pack_multiple: pack,
        min_coverage_qty: minQty,
        safety_stock_units: minQty
      };

      const item = this.items.find(i => (
        i.code_frumusa === skuKey || i.codeFrumusa === skuKey || 
        i.code_country === skuKey || i.codeCountry === skuKey || 
        i.codeSku === skuKey
      ));
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

    localStorage.setItem('codisa_catalog_overrides', JSON.stringify(overrides));
    this.recalculateAndRender();
    window.Toast.show('¡Todos los cambios del Maestro de Artículos fueron guardados exitosamente!', 'success');
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
