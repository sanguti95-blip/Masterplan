/**
 * Motor de Planificación Maestra (MRP Engine) para Retail
 * Autor / Product Owner: Milton Sánchez Gutiérrez
 * Versión: 2.0 (Lógica Min/Max + Tránsito Dinámico 72h + Frecuencia 4 pedidos semanales)
 */

const PLANNING_MATRIX = {
  Lunes: {
    dayName: 'Lunes',
    deliveryDay: 'Jueves',
    coverageDays: 1, // Jueves
    activeTransitDays: ['Jueves'], // La del jueves anterior
    leadTimeHours: 72,
    description: 'Cubre venta de Jueves. Considera 1 orden en tránsito (Jueves anterior).'
  },
  Martes: {
    dayName: 'Martes',
    deliveryDay: 'Viernes',
    coverageDays: 1, // Viernes
    activeTransitDays: ['Lunes'], // La del lunes
    leadTimeHours: 72,
    description: 'Cubre venta de Viernes. Considera 1 orden en tránsito (Lunes).'
  },
  Miercoles: {
    dayName: 'Miércoles',
    deliveryDay: 'Sábado',
    coverageDays: 3, // Sábado, Domingo, Lunes
    activeTransitDays: ['Lunes', 'Martes'], // Lunes y Martes
    leadTimeHours: 72,
    description: 'Cubre venta de Sábado, Domingo y Lunes. Considera 2 órdenes en tránsito (Lunes y Martes).'
  },
  Jueves: {
    dayName: 'Jueves',
    deliveryDay: 'Martes',
    coverageDays: 2, // Martes y Miércoles
    activeTransitDays: ['Martes', 'Miercoles'], // Martes y Miércoles
    leadTimeHours: 72,
    description: 'Cubre venta de Martes y Miércoles. Considera 2 órdenes en tránsito (Martes y Miércoles).'
  }
};

/**
 * Normaliza el nombre del día para evitar problemas de tildes o mayúsculas.
 */
function normalizeDayName(day) {
  if (!day) return 'Lunes';
  const clean = day.toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (clean.startsWith('lun')) return 'Lunes';
  if (clean.startsWith('mar')) return 'Martes';
  if (clean.startsWith('mie')) return 'Miercoles';
  if (clean.startsWith('jue')) return 'Jueves';
  if (clean.startsWith('vie')) return 'Viernes';
  if (clean.startsWith('sab')) return 'Sabado';
  if (clean.startsWith('dom')) return 'Domingo';
  return 'Lunes';
}

/**
 * Calcula la suma de órdenes en tránsito activas según el día de ejecución y el histórico.
 * @param {string} skuCode 
 * @param {string} executionDay 
 * @param {Array} activeOrdersList Lista de órdenes actualmente en tránsito
 * @param {number} manualTransitFallback Tránsito manual registrado en catálogo si no hay órdenes en BD
 */
function calculateActiveTransitForSku(skuCode, executionDay, activeOrdersList = [], manualTransitFallback = 0) {
  const normDay = normalizeDayName(executionDay);
  const matrixRule = PLANNING_MATRIX[normDay] || PLANNING_MATRIX.Lunes;
  
  if (!activeOrdersList || activeOrdersList.length === 0) {
    return Number(manualTransitFallback) || 0;
  }

  // Filtrar órdenes que correspondan a los días de tránsito activo según la matriz
  let sumTransit = 0;
  let hasMatchingOrders = false;

  activeOrdersList.forEach(order => {
    if (order.status === 'EN_TRANSITO') {
      const orderDay = normalizeDayName(order.execution_day || order.day);
      const isRelevant = matrixRule.activeTransitDays.some(d => normalizeDayName(d) === orderDay);
      
      if (isRelevant && Array.isArray(order.items)) {
        const item = order.items.find(i => (i.code_sku === skuCode || i.codeFrumusa === skuCode || i.codeCountry === skuCode));
        if (item) {
          sumTransit += Number(item.final_qty || item.quantity || 0);
          hasMatchingOrders = true;
        }
      }
    }
  });

  return hasMatchingOrders ? sumTransit : (Number(manualTransitFallback) || 0);
}

/**
 * Ejecuta el Algoritmo de Sugerido de 4 Pasos del Build Spec v2.0
 * 
 * Paso 1: Inv. Proyectado = Stock Actual (Codisa) + SUMA(Órdenes en Tránsito Activas)
 * Paso 2: Cobertura Meta = Días a Cubrir (según matriz) + Stock de Seguridad
 * Paso 3: Pedido Base = MAX(0, (VDP × Cobertura Meta) - Inv. Proyectado)
 * Paso 4: Sugerido Final = CEILING(Pedido Base, Múltiplo de Pedido)
 */
function calculateSkuReplenishment(product, executionDay = 'Lunes', activeOrders = [], globalSafetyStock = 1) {
  const normDay = normalizeDayName(executionDay);
  const matrix = PLANNING_MATRIX[normDay] || PLANNING_MATRIX.Lunes;

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
  const transitManual = Number(
    product.transit_qty !== undefined ? product.transit_qty :
    product.transitQty !== undefined ? product.transitQty :
    product.activeTransit !== undefined ? product.activeTransit :
    (product.transit || 0)
  );
  const activeTransit = calculateActiveTransitForSku(skuCode, normDay, activeOrders, transitManual);
  const projectedStock = stockActual + activeTransit;

  // === PASO 2: Cobertura Meta (Días) ===
  const daysToCover = matrix.coverageDays;
  const targetCoverageDays = daysToCover + safetyStockDays;

  // === PASO 3: Pedido Base ===
  const targetStockUnits = vdp * targetCoverageDays;
  const baseOrder = Math.max(0, targetStockUnits - projectedStock);

  // === PASO 4: Generación de Orden Final (Sugerido Final en Múltiplos) ===
  let suggestedUnits = 0;
  let suggestedBoxes = 0;

  if (baseOrder > 0) {
    suggestedBoxes = Math.ceil(baseOrder / packMultiple);
    suggestedUnits = suggestedBoxes * packMultiple;
  }

  // Override manual si existe
  const manualOverride = product.pedidoFinalOverride !== undefined && product.pedidoFinalOverride !== null ? Number(product.pedidoFinalOverride) : null;
  const finalQty = manualOverride !== null ? manualOverride : suggestedUnits;
  const finalBoxes = packMultiple > 0 ? Math.ceil(finalQty / packMultiple) : finalQty;

  // Cálculos Financieros y de Riesgo
  const totalOrderCost = finalQty * unitCost;
  
  // Cobertura proyectada en días
  let coverageDaysResult = 0;
  if (vdp > 0) {
    coverageDaysResult = (projectedStock + finalQty) / vdp;
  } else {
    coverageDaysResult = (projectedStock + finalQty) > 0 ? 999 : 0;
  }

  // Stockout Risk: Si el stock actual + tránsito antes del nuevo pedido no cubre los días necesarios
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
    executionDay: matrix.dayName,
    deliveryDay: matrix.deliveryDay
  };
}

module.exports = {
  PLANNING_MATRIX,
  normalizeDayName,
  calculateActiveTransitForSku,
  calculateSkuReplenishment
};
