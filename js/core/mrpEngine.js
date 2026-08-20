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
    if (!skuCode) return Number(manualTransit) || 0;
    const cleanSku = skuCode.toString().trim().toUpperCase();

    if (activeOrders && activeOrders.length > 0) {
      let sum = 0;
      let found = false;

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
            found = true;
          }
        }
      });

      if (found) return sum;
    }

    return Number(manualTransit) || 0;
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
    } else {
      vdp = daysPeriod > 0 ? (salesPeriod / daysPeriod) : 0;
    }

    // 3. Múltiplo de Pedido (Empaque)
    const packMultiple = Math.max(1, Number(
      product.pack_multiple !== undefined ? product.pack_multiple :
      product.packMultiple !== undefined ? product.packMultiple :
      (product.multiplo || 1)
    ));

    // 4. Stock de Seguridad (SS)
    const safetyStockDays = Number(
      product.safety_stock_days !== undefined ? product.safety_stock_days :
      product.safetyStockDays !== undefined ? product.safetyStockDays :
      (product.coberturaMeta !== undefined && product.coberturaMeta !== null ? product.coberturaMeta : globalSafetyStock)
    ) || globalSafetyStock;

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

    // === PASO 2: Cobertura Meta ===
    const daysToCover = matrixRule.coverageDays;
    const targetCoverageDays = daysToCover + safetyStockDays;

    // === PASO 3: Pedido Base ===
    const targetStockUnits = vdp * targetCoverageDays;
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

    // Cobertura proyectada resultante
    let coverageDaysResult = 0;
    if (vdp > 0) {
      coverageDaysResult = (projectedStock + finalQty) / vdp;
    } else {
      coverageDaysResult = (projectedStock + finalQty) > 0 ? 999 : 0;
    }

    // Stockout Risk: Si stock actual + tránsito antes de nueva orden no cubre los días necesarios
    const preOrderCoverageDays = vdp > 0 ? (projectedStock / vdp) : 999;
    const isCritical = (vdp > 0) && (preOrderCoverageDays < daysToCover);

    return {
      codeSku: skuCode,
      codeCountry: product.code_country || product.codeCountry || '',
      codeFrumusa: product.code_frumusa || product.codeFrumusa || skuCode,
      description,
      category,
      unitCost,
      unitPrice,
      stockActual,
      activeTransit,
      projectedStock,
      vdp,
      daysPeriod,
      salesPeriod,
      packMultiple,
      safetyStockDays,
      daysToCover,
      targetCoverageDays,
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
