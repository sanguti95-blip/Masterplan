/**
 * Frontend MRP Calculation Engine (Lógica Min/Max + Tránsito Dinámico 72h)
 * Matches backend formulas 100% for offline and instant calculations.
 */
const MrpEngine = {
  // Matrix definitions
  matrix: window.APP_CONFIG ? window.APP_CONFIG.planningMatrix : {
    Lunes: { dayName: 'Lunes', deliveryDay: 'Jueves', coverageDays: 1, activeTransitDays: ['Jueves'] },
    Martes: { dayName: 'Martes', deliveryDay: 'Viernes', coverageDays: 1, activeTransitDays: ['Lunes'] },
    Miercoles: { dayName: 'Miércoles', deliveryDay: 'Sábado', coverageDays: 3, activeTransitDays: ['Lunes', 'Martes'] },
    Jueves: { dayName: 'Jueves', deliveryDay: 'Martes', coverageDays: 2, activeTransitDays: ['Martes', 'Miercoles'] }
  },

  normalizeDayName(day) {
    if (!day) return 'Lunes';
    const clean = day.toString().trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (clean.startsWith('lun')) return 'Lunes';
    if (clean.startsWith('mar')) return 'Martes';
    if (clean.startsWith('mie')) return 'Miercoles';
    if (clean.startsWith('jue')) return 'Jueves';
    if (clean.startsWith('vie')) return 'Viernes';
    return 'Lunes';
  },

  calculateActiveTransit(skuCode, executionDay, activeOrders = [], manualTransit = 0) {
    if (!skuCode) return 0;
    const cleanSku = skuCode.toString().trim().toUpperCase();

    if (Array.isArray(activeOrders) && activeOrders.length > 0) {
      let sum = 0;
      activeOrders.forEach(order => {
        if (order.status === 'EN_TRANSITO' && Array.isArray(order.items)) {
          const item = order.items.find(i => {
            const k1 = (i.codeSku || i.code_sku || '').toString().trim().toUpperCase();
            const k2 = (i.codeFrumusa || '').toString().trim().toUpperCase();
            const k3 = (i.codeCountry || '').toString().trim().toUpperCase();
            return k1 === cleanSku || k2 === cleanSku || k3 === cleanSku;
          });

          if (item) {
            sum += Number(item.finalQty || item.quantity || 0);
          }
        }
      });
      return sum;
    }

    return 0;
  },

  /**
   * Calculates replenishment for an individual SKU using the 4-step algorithm
   */
  calculateItem(product, executionDay = 'Lunes', activeOrders = [], globalSafetyStock = 1) {
    const normDay = this.normalizeDayName(executionDay);
    const matrixRule = this.matrix[normDay] || this.matrix.Lunes;

    const skuCode = (product.code_frumusa || product.codeFrumusa || product.NO_ARTI || product.codeCountry || '').toString().trim();
    const description = product.description || product.descripcion || product.ARTICULO || '';
    const category = product.category || product.categoria || 'General';

    // 1. Stock Actual (Codisa)
    const stockActual = Number(
      product.stock_actual !== undefined ? product.stock_actual :
      product.stockActual !== undefined ? product.stockActual :
      product.stock !== undefined ? product.stock :
      (product.SALDO_ACTUAL || 0)
    ) || 0;

    // 2. Venta Diaria Promedio (VDP)
    let vdp = 0;
    const salesPeriod = Number(
      product.sales_period !== undefined ? product.sales_period :
      product.salesPeriod !== undefined ? product.salesPeriod :
      product.ventas !== undefined ? product.ventas :
      (product.CANTIDAD || 0)
    ) || 0;
    const daysPeriod = Number(product.days_period || product.daysPeriod || product.diasPeriodo || 30);

    if (product.vdp !== undefined && product.vdp !== null && !isNaN(product.vdp) && Number(product.vdp) > 0) {
      vdp = Number(product.vdp);
    } else if (daysPeriod === 60 && product.sales_60d && Number(product.sales_60d) > 0) {
      vdp = Number(product.sales_60d) / 50; // 50 días efectivos acumulados (Julio 31d + Agosto 19d)
    } else if (daysPeriod <= 30 && product.days_in_month_cut && Number(product.days_in_month_cut) > 0) {
      vdp = salesPeriod / Number(product.days_in_month_cut);
    } else {
      vdp = daysPeriod > 0 ? (salesPeriod / daysPeriod) : 0;
    }

    // 3. Múltiplo de Pedido (Empaque)
    const packMultiple = Math.max(1, Number(
      product.pack_multiple !== undefined ? product.pack_multiple :
      product.packMultiple !== undefined ? product.packMultiple :
      (product.multiplo || 1)
    ));

    // 4. Cobertura Mínima (Cantidad / Unidades)
    const minCoverageUnits = Math.round(Number(
      product.min_coverage_qty !== undefined ? product.min_coverage_qty :
      product.minCoverageQty !== undefined ? product.minCoverageQty :
      product.safety_stock_units !== undefined ? product.safety_stock_units :
      product.safetyStockUnits !== undefined ? product.safetyStockUnits :
      product.min_coverage !== undefined ? product.min_coverage :
      (product.cobertura_minima !== undefined ? product.cobertura_minima :
       (product.safety_stock_days !== undefined ? (vdp * Number(product.safety_stock_days)) : packMultiple))
    ) || 0);

    // 5. Costo Unitario y Precio
    const unitCost = Number(
      product.unit_cost !== undefined ? product.unit_cost :
      product.unitCost !== undefined ? product.unitCost :
      product.cost !== undefined ? product.cost :
      (product.COSTO_UNITARIO || 0)
    ) || 0;
    const unitPrice = Number(
      product.unit_price !== undefined ? product.unit_price :
      product.unitPrice !== undefined ? product.unitPrice :
      (product.PRECIO || 0)
    ) || 0;

    // === PASO 1: Inventario Proyectado ===
    const transitSaved = Number(
      product.transit_qty !== undefined ? product.transit_qty :
      product.transitQty !== undefined ? product.transitQty :
      product.activeTransit !== undefined ? product.activeTransit :
      (product.transit || 0)
    );
    const activeTransit = this.calculateActiveTransit(skuCode, normDay, activeOrders, transitSaved);
    const projectedStock = stockActual + activeTransit;

    // === PASO 2: Demanda del Ciclo e Inventario Meta Total (Unidades) ===
    const daysToCover = matrixRule.coverageDays;
    const cycleDemand = vdp * daysToCover;
    const targetStockUnits = cycleDemand + minCoverageUnits;

    // === PASO 3: Faltante / Pedido Base (Unidades) ===
    const baseOrder = Math.max(0, targetStockUnits - projectedStock);

    // === PASO 4: Generación de Sugerido Final en Múltiplos y Cajas ===
    let suggestedUnits = 0;
    let suggestedBoxes = 0;

    if (baseOrder > 0) {
      suggestedBoxes = Math.ceil(baseOrder / packMultiple);
      suggestedUnits = suggestedBoxes * packMultiple;
    }

    // Override manual
    const manualOverride = product.pedidoFinalOverride !== undefined && product.pedidoFinalOverride !== null && product.pedidoFinalOverride !== '' ? Number(product.pedidoFinalOverride) : null;
    const finalQty = manualOverride !== null ? manualOverride : suggestedUnits;
    const finalBoxes = packMultiple > 0 ? Math.ceil(finalQty / packMultiple) : finalQty;

    const totalOrderCost = finalQty * unitCost;

    // Cobertura proyectada resultante en días
    let coverageDaysResult = 0;
    if (vdp > 0) {
      coverageDaysResult = (projectedStock + finalQty) / vdp;
    } else {
      coverageDaysResult = (projectedStock + finalQty) > 0 ? 999 : 0;
    }

    // Stockout Risk: Si el inventario proyectado no cubre la cobertura mínima
    const preOrderCoverageDays = vdp > 0 ? (projectedStock / vdp) : 999;
    const isCritical = (projectedStock <= minCoverageUnits);

    return {
      codeSku: skuCode,
      code_sku: skuCode,
      codeCountry: product.code_country || product.codeCountry || (product.code_frumusa ? '' : skuCode),
      code_country: product.code_country || product.codeCountry || (product.code_frumusa ? '' : skuCode),
      codeFrumusa: product.code_frumusa || product.codeFrumusa || '',
      code_frumusa: product.code_frumusa || product.codeFrumusa || '',
      description,
      category,
      unitCost,
      unitPrice,
      unit_eq: product.unit_eq || product.UNIDAD_EQ || 'UD',
      stockActual,
      stock_actual: stockActual,
      activeTransit,
      transit_qty: activeTransit,
      projectedStock,
      vdp,
      daysPeriod,
      salesPeriod,
      packMultiple,
      pack_multiple: packMultiple,
      minCoverageUnits,
      min_coverage_qty: minCoverageUnits,
      safety_stock_units: minCoverageUnits,
      safetyStockDays: vdp > 0 ? (minCoverageUnits / vdp) : 0,
      daysToCover,
      cycleDemand,
      targetStockUnits,
      baseOrder,
      suggestedUnits,
      suggestedBoxes,
      manualOverride,
      finalQty,
      finalBoxes,
      totalOrderCost,
      coverageDaysResult,
      preOrderCoverageDays,
      isCritical,
      executionDay: matrixRule.dayName,
      deliveryDay: matrixRule.deliveryDay
    };
  }
};

window.MrpEngine = MrpEngine;
