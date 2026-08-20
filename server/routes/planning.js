const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const db = require('../db/pool');
const mrpEngine = require('../services/mrpEngine');
const config = require('../config');

// GET /api/planning/matrix
router.get('/matrix', (req, res) => {
  res.json({
    matrix: mrpEngine.PLANNING_MATRIX,
    leadTimeHours: config.DEFAULT_LEAD_TIME_HOURS,
    safetyStockDays: db.memoryStore.settings.safetyStockDays
  });
});

// GET /api/planning/calculate?day=Lunes
router.get('/calculate', (req, res) => {
  try {
    const rawDay = req.query.day || 'Lunes';
    const executionDay = mrpEngine.normalizeDayName(rawDay);
    const safetyStock = Number(req.query.safetyStock) || db.memoryStore.settings.safetyStockDays || 1;
    const vdpDays = Number(req.query.vdpDays) || 60;

    const products = db.memoryStore.products || [];
    const activeOrders = (db.memoryStore.orders || []).filter(o => o.status === 'EN_TRANSITO');

    let totalCost = 0;
    let totalItemsToOrder = 0;
    let totalCriticalCount = 0;
    let totalUnits = 0;
    let totalBoxes = 0;

    const calculatedItems = products.map(product => {
      const prodCopy = { ...product, days_period: vdpDays, daysPeriod: vdpDays };
      const calc = mrpEngine.calculateSkuReplenishment(prodCopy, executionDay, activeOrders, safetyStock);

      totalCost += calc.totalOrderCost;
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

    const matrixRule = mrpEngine.PLANNING_MATRIX[executionDay] || mrpEngine.PLANNING_MATRIX.Lunes;

    res.json({
      executionDay,
      deliveryDay: matrixRule.deliveryDay,
      coverageDays: matrixRule.coverageDays,
      activeTransitDays: matrixRule.activeTransitDays,
      safetyStockDays: safetyStock,
      totalCatalogCount: products.length,
      kpis: {
        totalCost,
        totalItemsToOrder,
        totalCriticalCount,
        totalUnits,
        totalBoxes,
        currency: config.CURRENCY,
        currencySymbol: config.CURRENCY_SYMBOL
      },
      items: calculatedItems
    });
  } catch (error) {
    console.error('Error calculating MRP:', error);
    res.status(500).json({ error: 'Error al calcular la planificación MRP.' });
  }
});

// POST /api/planning/approve - Approve Planned Order and add to In-Transit
router.post('/approve', (req, res) => {
  try {
    const { executionDay, items, notes, createdBy } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No se enviaron artículos para aprobar.' });
    }

    const normDay = mrpEngine.normalizeDayName(executionDay || 'Lunes');
    const matrixRule = mrpEngine.PLANNING_MATRIX[normDay] || mrpEngine.PLANNING_MATRIX.Lunes;

    // Filter items with quantity > 0
    const approvedItems = items.filter(i => Number(i.finalQty || i.quantity || 0) > 0);

    if (approvedItems.length === 0) {
      return res.status(400).json({ error: 'Todos los artículos tienen cantidad 0. No hay orden para aprobar.' });
    }

    let totalCost = 0;
    let totalUnits = 0;
    let totalBoxes = 0;

    const formattedItems = approvedItems.map(item => {
      const qty = Number(item.finalQty || item.quantity || 0);
      const mult = Math.max(1, Number(item.packMultiple || item.multiplo || 1));
      const boxes = Math.ceil(qty / mult);
      const unitCost = Number(item.unitCost || item.cost || 0);
      const itemCost = qty * unitCost;

      totalCost += itemCost;
      totalUnits += qty;
      totalBoxes += boxes;

      return {
        codeSku: item.codeSku || item.codeFrumusa || item.codeCountry,
        description: item.description || item.descripcion,
        projectedStock: item.projectedStock || 0,
        vdp: item.vdp || 0,
        targetCoverageDays: item.targetCoverageDays || 0,
        suggestedQty: item.suggestedUnits || item.suggestedQty || 0,
        finalQty: qty,
        finalBoxes: boxes,
        packMultiple: mult,
        unitCost: unitCost,
        totalCost: itemCost
      };
    });

    const now = new Date();
    const orderId = `ORD-${normDay.toUpperCase()}-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Date.now().toString().slice(-4)}`;

    const newOrder = {
      id: orderId,
      orderCode: orderId,
      executionDay: normDay,
      deliveryDay: matrixRule.deliveryDay,
      createdAt: now.toISOString(),
      expectedDeliveryDate: new Date(Date.now() + 72 * 3600 * 1000).toISOString().slice(0, 10),
      status: 'EN_TRANSITO',
      totalCost,
      totalUnits,
      totalBoxes,
      totalItems: formattedItems.length,
      createdBy: createdBy || 'Milton Sánchez Gutiérrez',
      notes: notes || `Orden generada en cálculo de ${normDay} para entrega en ${matrixRule.deliveryDay}`,
      items: formattedItems
    };

    db.memoryStore.orders.unshift(newOrder);

    // Update in-memory product transit
    formattedItems.forEach(item => {
      const prod = db.memoryStore.products.find(p => (p.code_frumusa === item.codeSku || p.codeFrumusa === item.codeSku || p.NO_ARTI === item.codeSku));
      if (prod) {
        prod.transit_qty = (Number(prod.transit_qty || 0)) + item.finalQty;
        prod.transit = prod.transit_qty;
      }
    });

    res.status(201).json({
      success: true,
      message: `¡Orden ${orderId} aprobada exitosamente! ${formattedItems.length} artículos agregados al inventario en tránsito.`,
      order: newOrder
    });
  } catch (error) {
    console.error('Error approving order:', error);
    res.status(500).json({ error: 'Error al procesar la aprobación de la orden.' });
  }
});

// GET /api/planning/transit - List Active In-Transit Orders
router.get('/transit', (req, res) => {
  const activeOrders = (db.memoryStore.orders || []).filter(o => o.status === 'EN_TRANSITO');
  res.json({
    totalActiveOrders: activeOrders.length,
    orders: activeOrders
  });
});

// POST /api/planning/transit/reconcile - Mark order as received in physical warehouse
router.post('/transit/reconcile', (req, res) => {
  try {
    const { orderId } = req.body;
    const order = db.memoryStore.orders.find(o => o.id === orderId || o.orderCode === orderId);

    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada en el registro de tránsito.' });
    }

    order.status = 'RECIBIDO';
    order.receivedAt = new Date().toISOString();

    // Adjust product transit
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        const prod = db.memoryStore.products.find(p => (p.code_frumusa === item.codeSku || p.codeFrumusa === item.codeSku || p.NO_ARTI === item.codeSku));
        if (prod) {
          prod.transit_qty = Math.max(0, (Number(prod.transit_qty || 0)) - item.finalQty);
          prod.transit = prod.transit_qty;
        }
      });
    }

    res.json({
      success: true,
      message: `Orden ${orderId} marcada como RECIBIDA. Saldo liberado del inventario en tránsito.`,
      order
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al conciliar la orden.' });
  }
});

// POST /api/planning/export-excel - Generate Excel XLSX file buffer
router.post('/export-excel', (req, res) => {
  try {
    const { order, executionDay, items } = req.body;
    const exportItems = items || (order ? order.items : []);

    if (!exportItems || exportItems.length === 0) {
      return res.status(400).json({ error: 'No hay datos para exportar.' });
    }

    // Build worksheet rows
    const wsData = [
      ['ORDEN DE COMPRA SUGERIDA - MASTER PLANNING CODISA'],
      [`Día de Ejecución: ${executionDay || 'Lunes'}`, `Fecha de Generación: ${new Date().toLocaleDateString('es-CR')}`],
      [`Lead Time: 72 Horas`, `Moneda: CRC (₡)`],
      [], // Empty row
      [
        'Código SKU',
        'Descripción',
        'Venta Diaria (VDP)',
        'Stock Codisa',
        'Tránsito Activo',
        'Inv. Proyectado',
        'Múltiplo Empaque',
        'Cantidad en Cajas',
        'Cantidad Final (Unidades)',
        'Costo Unitario (₡)',
        'Costo Total Pedido (₡)'
      ]
    ];

    let grandTotalUnits = 0;
    let grandTotalBoxes = 0;
    let grandTotalCost = 0;

    exportItems.forEach(item => {
      const qty = Number(item.finalQty || item.quantity || 0);
      if (qty > 0) {
        const mult = Number(item.packMultiple || item.multiplo || 1);
        const boxes = Math.ceil(qty / mult);
        const costUnit = Number(item.unitCost || item.cost || 0);
        const costTotal = qty * costUnit;

        grandTotalUnits += qty;
        grandTotalBoxes += boxes;
        grandTotalCost += costTotal;

        wsData.push([
          item.codeSku || item.codeFrumusa || item.codeCountry,
          item.description || item.descripcion,
          Number((item.vdp || 0).toFixed(2)),
          Number(item.stockActual !== undefined ? item.stockActual : item.stock || 0),
          Number(item.activeTransit !== undefined ? item.activeTransit : item.transit || 0),
          Number(item.projectedStock || 0),
          mult,
          boxes,
          qty,
          Number(costUnit.toFixed(2)),
          Number(costTotal.toFixed(2))
        ]);
      }
    });

    // Add Totals row
    wsData.push([]);
    wsData.push([
      'TOTAL GENERAL',
      '',
      '',
      '',
      '',
      '',
      '',
      grandTotalBoxes,
      grandTotalUnits,
      '',
      grandTotalCost
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = [
      { wch: 14 },
      { wch: 38 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 24 },
      { wch: 18 },
      { wch: 22 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Pedido_Final_CODISA');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `Pedido_${executionDay || 'MRP'}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).json({ error: 'Error al generar el archivo Excel.' });
  }
});

module.exports = router;
