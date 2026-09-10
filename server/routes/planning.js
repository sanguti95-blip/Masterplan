const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const db = require('../db/pool');
const kvStore = require('../db/keyValueStore');
const mrpEngine = require('../services/mrpEngine');
const config = require('../config');

const ordersFilePath = path.join(__dirname, '..', '..', 'data', 'active_orders.json');

async function persistOrdersToDisk(orders) {
  try {
    // 1. Persist to Postgres Key-Value Store if DB is connected
    const savedToDb = await kvStore.set('active_orders', orders);

    // 2. Fallback / Sync to Local File System
    const dataDir = path.dirname(ordersFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(ordersFilePath, JSON.stringify(orders || [], null, 2), 'utf8');
    
    console.log(`📦 [Orders Store]: ${orders ? orders.length : 0} órdenes guardadas en disco${savedToDb ? ' y DB' : ''}.`);
  } catch (e) {
    console.warn('⚠️ Error al persistir órdenes:', e.message);
  }
}

async function syncOrderToPostgres(order) {
  try {
    const text = `
      INSERT INTO mrp_purchase_orders (
        id, order_code, order_number, day, execution_day, delivery_day, status,
        total_cost, total_boxes, total_units, total_items, created_by, notes, items, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        total_cost = EXCLUDED.total_cost,
        total_boxes = EXCLUDED.total_boxes,
        total_units = EXCLUDED.total_units,
        total_items = EXCLUDED.total_items,
        notes = EXCLUDED.notes,
        items = EXCLUDED.items,
        updated_at = CURRENT_TIMESTAMP;
    `;
    const params = [
      order.id || order.orderCode,
      order.orderCode || order.id,
      order.orderNumber || order.id,
      order.day || order.executionDay || 'Lunes',
      order.executionDay || order.day || 'Lunes',
      order.deliveryDay || 'Jueves',
      order.status || 'EN_TRANSITO',
      Number(order.totalCost || 0),
      Number(order.totalBoxes || 0),
      Number(order.totalUnits || 0),
      Number(order.totalItems || (order.items ? order.items.length : 0)),
      order.createdBy || 'Milton Sánchez Gutiérrez',
      order.notes || '',
      JSON.stringify(order.items || []),
      order.createdAt ? new Date(order.createdAt) : new Date()
    ];
    await db.query(text, params);

    await db.query(`
      INSERT INTO mrp_audit_logs (entity_type, entity_id, action, user_name, changes)
      VALUES ('PURCHASE_ORDER', $1, 'APPROVE', $2, $3);
    `, [order.id || order.orderCode, order.createdBy || 'Milton Sánchez', JSON.stringify({ totalCost: order.totalCost, totalItems: order.totalItems, day: order.executionDay })]);
  } catch (err) {
    console.warn('⚠️ [Postgres Order Sync Warning]:', err.message);
  }
}

async function syncOrderReceptionToPostgres(orderId, receptionData) {
  try {
    await db.query(`
      UPDATE mrp_purchase_orders
      SET status = 'RECEPCIONADO', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 OR order_code = $1;
    `, [orderId]);

    await db.query(`
      INSERT INTO mrp_order_receptions (
        order_id, received_by, total_boxes_received, total_units_received, invoice_variance_cost, notes, items_received
      ) VALUES ($1, $2, $3, $4, $5, $6, $7);
    `, [
      orderId,
      receptionData.receivedBy || 'Bodega Santo Domingo',
      Number(receptionData.totalBoxesReceived || 0),
      Number(receptionData.totalUnitsReceived || 0),
      Number(receptionData.invoiceVarianceCost || 0),
      receptionData.notes || '',
      JSON.stringify(receptionData.itemsReceived || [])
    ]);

    await db.query(`
      INSERT INTO mrp_audit_logs (entity_type, entity_id, action, user_name, changes)
      VALUES ('PURCHASE_ORDER', $1, 'RECEIVE', $2, $3);
    `, [orderId, receptionData.receivedBy || 'Bodega Santo Domingo', JSON.stringify(receptionData)]);
  } catch (err) {
    console.warn('⚠️ [Postgres Reception Sync Warning]:', err.message);
  }
}

async function updateOrderPostgresStatus(orderId, status) {
  try {
    await db.query(`
      UPDATE mrp_purchase_orders
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 OR order_code = $2;
    `, [status, orderId]);

    await db.query(`
      INSERT INTO mrp_audit_logs (entity_type, entity_id, action, user_name, changes)
      VALUES ('PURCHASE_ORDER', $1, $2, 'Planner', $3);
    `, [orderId, status, JSON.stringify({ status })]);
  } catch (err) {
    console.warn('⚠️ [Postgres Status Update Warning]:', err.message);
  }
}

// GET /api/planning/matrix
router.get('/matrix', (req, res) => {
  res.json({
    matrix: mrpEngine.PLANNING_MATRIX,
    leadTimeHours: config.DEFAULT_LEAD_TIME_HOURS,
    safetyStockDays: db.memoryStore.settings.safetyStockDays
  });
});

// POST /api/planning/config - Save server planning settings
router.post('/config', (req, res) => {
  try {
    const { safetyStock, defaultVdpDays, warehouseName, plannerName } = req.body || {};
    if (safetyStock !== undefined) db.memoryStore.settings.safetyStockDays = Number(safetyStock);
    if (defaultVdpDays !== undefined) db.memoryStore.settings.defaultVdpDays = Number(defaultVdpDays);
    if (warehouseName !== undefined) db.memoryStore.settings.warehouseName = warehouseName;
    if (plannerName !== undefined) db.memoryStore.settings.plannerName = plannerName;

    res.json({
      success: true,
      message: 'Configuración guardada exitosamente en el servidor.',
      settings: db.memoryStore.settings
    });
  } catch (e) {
    res.status(500).json({ error: 'Error al guardar configuración en el servidor.' });
  }
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

      if (calc.is_active !== false && calc.isActive !== false) {
        totalCost += calc.totalOrderCost;
        if (calc.finalQty > 0) {
          totalItemsToOrder++;
          totalUnits += calc.finalQty;
          totalBoxes += calc.finalBoxes;
        }
        if (calc.isCritical) {
          totalCriticalCount++;
        }
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
router.post('/approve', async (req, res) => {
  try {
    const { executionDay, items, order, notes, createdBy } = req.body;
    const rawItems = items || (order ? order.items : []);

    if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ error: 'No se enviaron artículos para aprobar.' });
    }

    const normDay = mrpEngine.normalizeDayName(executionDay || (order ? order.executionDay : 'Lunes'));
    const matrixRule = mrpEngine.PLANNING_MATRIX[normDay] || mrpEngine.PLANNING_MATRIX.Lunes;

    let totalCost = 0;
    let totalUnits = 0;
    let totalBoxes = 0;
    const formattedItems = [];

    rawItems.forEach(item => {
      const finalQty = Number(item.finalQty !== undefined ? item.finalQty : item.quantity || 0);
      const unitCost = Number(item.unitCost || item.cost || 0);
      const packMultiple = Math.max(1, Number(item.packMultiple || item.multiplo || 1));
      const finalBoxes = Math.ceil(finalQty / packMultiple);
      const itemCost = finalQty * unitCost;

      if (finalQty > 0) {
        totalCost += itemCost;
        totalUnits += finalQty;
        totalBoxes += finalBoxes;

        formattedItems.push({
          codeSku: item.codeSku || item.codeFrumusa || item.codeCountry,
          codeCountry: item.codeCountry || item.codeSku,
          codeFrumusa: item.codeFrumusa || item.codeSku,
          description: item.description || item.descripcion || 'Producto',
          category: item.category || 'Perecederos',
          boxes: finalBoxes,
          quantity: finalQty,
          finalQty: finalQty,
          finalBoxes: finalBoxes,
          unitCost: unitCost,
          totalCost: itemCost,
          packMultiple
        });
      }
    });

    if (formattedItems.length === 0) {
      return res.status(400).json({ error: 'El pedido no contiene cantidades mayores a 0.' });
    }

    const now = new Date();
    // Prioritize client-generated orderId so client and server remain identical and avoid duplicate cards
    const orderId = (order && (order.id || order.orderCode)) 
      ? (order.id || order.orderCode) 
      : `ORD-${normDay.toUpperCase()}-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Date.now().toString().slice(-4)}`;

    const orderNumber = (order && order.orderNumber)
      ? order.orderNumber
      : `PED-${normDay.slice(0, 3).toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(db.memoryStore.orders.length + 1).padStart(2, '0')}`;

    const newOrder = {
      id: orderId,
      orderCode: orderId,
      orderNumber,
      day: normDay,
      executionDay: normDay,
      deliveryDay: matrixRule.deliveryDay,
      createdAt: (order && order.createdAt) ? order.createdAt : now.toISOString(),
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

    // Deduplicate: replace existing order with same ID if present
    const existingIdx = db.memoryStore.orders.findIndex(o => o.id === orderId || o.orderCode === orderId);
    if (existingIdx >= 0) {
      db.memoryStore.orders[existingIdx] = newOrder;
    } else {
      db.memoryStore.orders.unshift(newOrder);
    }

    // Update in-memory product transit
    formattedItems.forEach(item => {
      const prod = db.memoryStore.products.find(p => (
        (p.code_frumusa && p.code_frumusa.toString() === item.codeSku) ||
        (p.codeFrumusa && p.codeFrumusa.toString() === item.codeSku) ||
        (p.code_country && p.code_country.toString() === item.codeSku) ||
        (p.codeCountry && p.codeCountry.toString() === item.codeSku) ||
        (p.codeSku && p.codeSku.toString() === item.codeSku) ||
        (p.NO_ARTI && p.NO_ARTI.toString() === item.codeSku)
      ));
      if (prod) {
        prod.transit_qty = (Number(prod.transit_qty || 0)) + item.quantity;
        prod.transit = prod.transit_qty;
      }
    });

    await persistOrdersToDisk(db.memoryStore.orders);
    await syncOrderToPostgres(newOrder);

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
router.get('/transit', async (req, res) => {
  try {
    const dbRes = await db.query("SELECT * FROM mrp_purchase_orders WHERE status = 'EN_TRANSITO' ORDER BY created_at DESC");
    if (dbRes && Array.isArray(dbRes.rows) && dbRes.rows.length > 0) {
      const dbOrders = dbRes.rows.map(row => ({
        id: row.id,
        orderCode: row.order_code,
        orderNumber: row.order_number,
        day: row.day,
        executionDay: row.execution_day,
        deliveryDay: row.delivery_day,
        status: row.status,
        totalCost: Number(row.total_cost || 0),
        totalBoxes: Number(row.total_boxes || 0),
        totalUnits: Number(row.total_units || 0),
        totalItems: Number(row.total_items || 0),
        createdBy: row.created_by,
        notes: row.notes,
        items: row.items || [],
        createdAt: row.created_at
      }));

      // Keep memoryStore updated with DB truth
      db.memoryStore.orders = dbOrders;

      return res.json({
        totalActiveOrders: dbOrders.length,
        orders: dbOrders
      });
    }
  } catch (err) {
    console.warn('⚠️ [Postgres Transit Query Warning]:', err.message);
  }

  // Fallback to memoryStore
  const activeOrders = (db.memoryStore.orders || []).filter(o => o.status === 'EN_TRANSITO');
  res.json({
    totalActiveOrders: activeOrders.length,
    orders: activeOrders
  });
});

// DELETE /api/planning/transit - Clear all In-Transit orders
router.delete('/transit', async (req, res) => {
  try {
    db.memoryStore.orders = [];
    if (Array.isArray(db.memoryStore.products)) {
      db.memoryStore.products.forEach(p => {
        p.transit_qty = 0;
        p.transit = 0;
      });
    }
    await persistOrdersToDisk([]);
    await db.query("UPDATE mrp_purchase_orders SET status = 'CANCELADO', updated_at = CURRENT_TIMESTAMP WHERE status = 'EN_TRANSITO'");

    res.json({
      success: true,
      message: 'Todos los pedidos en tránsito han sido eliminados del servidor y base de datos.',
      totalActiveOrders: 0,
      orders: []
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar pedidos en tránsito.' });
  }
});

// POST /api/planning/transit/clear - Clear all In-Transit orders (POST alias)
router.post('/transit/clear', async (req, res) => {
  try {
    db.memoryStore.orders = [];
    if (Array.isArray(db.memoryStore.products)) {
      db.memoryStore.products.forEach(p => {
        p.transit_qty = 0;
        p.transit = 0;
      });
    }
    await persistOrdersToDisk([]);
    await db.query("UPDATE mrp_purchase_orders SET status = 'CANCELADO', updated_at = CURRENT_TIMESTAMP WHERE status = 'EN_TRANSITO'");

    res.json({
      success: true,
      message: 'Todos los pedidos en tránsito han sido eliminados del servidor y base de datos.',
      totalActiveOrders: 0,
      orders: []
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar pedidos en tránsito.' });
  }
});

// DELETE /api/planning/transit/:orderId - Delete single transit order
router.delete('/transit/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const orderIndex = db.memoryStore.orders.findIndex(o => o.id === orderId || o.orderCode === orderId || o.orderNumber === orderId);
    let deleted = null;
    if (orderIndex >= 0) {
      [deleted] = db.memoryStore.orders.splice(orderIndex, 1);
    }

    if (deleted && deleted.items) {
      deleted.items.forEach(item => {
        const itemKey = (item.codeSku || item.codeFrumusa || item.codeCountry || '').toString().trim().toUpperCase();
        const prod = db.memoryStore.products.find(p => {
          const k1 = (p.code_frumusa || p.codeFrumusa || '').toString().trim().toUpperCase();
          const k2 = (p.code_country || p.codeCountry || '').toString().trim().toUpperCase();
          const k3 = (p.codeSku || '').toString().trim().toUpperCase();
          return k1 === itemKey || k2 === itemKey || k3 === itemKey;
        });
        if (prod) {
          prod.transit_qty = Math.max(0, (Number(prod.transit_qty || 0)) - (item.finalQty || item.quantity || 0));
          prod.transit = prod.transit_qty;
        }
      });
    }

    await persistOrdersToDisk(db.memoryStore.orders);
    await updateOrderPostgresStatus(orderId, 'CANCELADO');

    res.json({
      success: true,
      message: `Orden ${orderId} eliminada del servidor y actualizada en base de datos.`,
      orders: db.memoryStore.orders
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar orden.' });
  }
});

// Helper for receiving an order in store intake
async function handleOrderReception(req, res) {
  try {
    const { orderId, receivedBy, notes, itemsReceived, invoiceVarianceCost } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: 'Falta el identificador de la orden (orderId).' });
    }

    const order = db.memoryStore.orders.find(o => o.id === orderId || o.orderCode === orderId || o.orderNumber === orderId);

    // Calculate totals received
    let totalBoxesReceived = 0;
    let totalUnitsReceived = 0;
    if (Array.isArray(itemsReceived) && itemsReceived.length > 0) {
      itemsReceived.forEach(it => {
        totalBoxesReceived += Number(it.boxesReceived || it.boxes || 0);
        totalUnitsReceived += Number(it.unitsReceived || it.quantity || it.finalQty || 0);
      });
    } else if (order) {
      totalBoxesReceived = Number(order.totalBoxes || 0);
      totalUnitsReceived = Number(order.totalUnits || 0);
    }

    if (order) {
      order.status = 'RECEPCIONADO';
      order.receivedAt = new Date().toISOString();
      order.receivedBy = receivedBy || 'Bodega Santo Domingo';

      // Deduct order from active in-transit product balances
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          const prod = db.memoryStore.products.find(p => (
            (p.code_frumusa && p.code_frumusa.toString() === item.codeSku) ||
            (p.codeFrumusa && p.codeFrumusa.toString() === item.codeSku) ||
            (p.code_country && p.code_country.toString() === item.codeSku) ||
            (p.codeCountry && p.codeCountry.toString() === item.codeSku) ||
            (p.codeSku && p.codeSku.toString() === item.codeSku) ||
            (p.NO_ARTI && p.NO_ARTI.toString() === item.codeSku)
          ));
          if (prod) {
            prod.transit_qty = Math.max(0, (Number(prod.transit_qty || 0)) - (item.finalQty || item.quantity || 0));
            prod.transit = prod.transit_qty;
          }
        });
      }

      await persistOrdersToDisk(db.memoryStore.orders);
    }

    // Persist to relational Postgres tables
    await syncOrderReceptionToPostgres(orderId, {
      receivedBy: receivedBy || 'Bodega Santo Domingo',
      totalBoxesReceived,
      totalUnitsReceived,
      invoiceVarianceCost: Number(invoiceVarianceCost || 0),
      notes: notes || '',
      itemsReceived: itemsReceived || (order ? order.items : [])
    });

    res.json({
      success: true,
      message: `¡Orden ${orderId} recepcionada y conciliada exitosamente en bodega! Tránsito liberado.`,
      orderId,
      status: 'RECEPCIONADO',
      receivedAt: new Date().toISOString(),
      totalBoxesReceived,
      totalUnitsReceived
    });
  } catch (error) {
    console.error('Error in order reception:', error);
    res.status(500).json({ error: 'Error al registrar la recepción de la orden.' });
  }
}

// POST /api/planning/receive - Store Intake / Warehouse Reception
router.post('/receive', handleOrderReception);

// POST /api/planning/transit/reconcile - Alias for backwards compatibility
router.post('/transit/reconcile', handleOrderReception);

// GET /api/planning/receptions - List Historical Receptions & Invoice Variance
router.get('/receptions', async (req, res) => {
  try {
    const dbRes = await db.query(`
      SELECT 
        r.id, r.order_id, r.received_at, r.received_by,
        r.total_boxes_received, r.total_units_received, r.invoice_variance_cost,
        r.notes, r.items_received,
        po.order_code, po.day, po.delivery_day, po.total_cost as order_cost, po.total_boxes as order_boxes
      FROM mrp_order_receptions r
      LEFT JOIN mrp_purchase_orders po ON r.order_id = po.id
      ORDER BY r.received_at DESC
      LIMIT 100;
    `);

    if (dbRes && dbRes.rows) {
      return res.json({
        totalReceptions: dbRes.rows.length,
        receptions: dbRes.rows
      });
    }
  } catch (err) {
    console.warn('⚠️ [Postgres Receptions Query Warning]:', err.message);
  }

  res.json({ totalReceptions: 0, receptions: [] });
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
      ['CODISA - ORDEN DE COMPRA Y PEDIDO DE REPOSICIÓN A PROVEEDOR (FRUMUSA)'],
      [`Día de Ejecución: ${executionDay || 'Lunes'}`, `Fecha de Generación: ${new Date().toLocaleDateString('es-CR')}`],
      [`Lead Time: 72 Horas`, `Moneda: CRC (₡)`],
      [], // Empty row
      [
        'Código Frumusa (Proveedor)',
        'Código Tienda (CODISA)',
        'Descripción',
        'Unidad de Medida',
        'Venta Diaria (VDP)',
        'Stock Codisa',
        'Tránsito Activo',
        'Inv. Proyectado',
        'Múltiplo Empaque',
        'Total Cajas Pedidas',
        'Total Unidades / Kilos',
        'Costo Unitario (₡)',
        'Inversión Total Pedido (₡)'
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

        const codeFrumusa = (item.codeFrumusa || item.code_frumusa || item.codeSku || '').toString().trim();
        const codeCountry = (item.codeCountry || item.code_country || '').toString().trim();
        const unit = (item.unit_eq || item.unit_fromusa || item.unit || 'UD').toString().trim();

        grandTotalUnits += qty;
        grandTotalBoxes += boxes;
        grandTotalCost += costTotal;

        wsData.push([
          codeFrumusa,
          codeCountry,
          item.description || item.descripcion || '',
          unit,
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
      `${exportItems.filter(i => (i.finalQty || i.quantity || 0) > 0).length} SKUs con pedido`,
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
      { wch: 18 },
      { wch: 16 },
      { wch: 40 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 22 },
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
