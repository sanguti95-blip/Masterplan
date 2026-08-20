const fs = require('fs');
const path = require('path');
const db = require('../server/db/pool');

function processSaturdayOrder() {
  const tsvPath = path.join(__dirname, 'orders_sabado_raw.tsv');
  const lines = fs.readFileSync(tsvPath, 'utf8').trim().split(/\r?\n/);
  
  // Load full merged catalog from data.js
  const dataJsPath = path.join(__dirname, '..', 'data.js');
  const code = fs.readFileSync(dataJsPath, 'utf8');
  const fn = new Function(code + '; return { INITIAL_CONFIG, INITIAL_PEDIDOS, INITIAL_DATA, INITIAL_HOJA1 };');
  const loaded = fn();
  
  const pedidos = loaded.INITIAL_PEDIDOS || [];
  const codisaData = loaded.INITIAL_DATA || [];

  const dataByNoArti = new Map();
  const dataByDesc = new Map();
  codisaData.forEach(row => {
    if (row.NO_ARTI) dataByNoArti.set(row.NO_ARTI.toString().trim().toUpperCase(), row);
    if (row.ARTICULO) dataByDesc.set(row.ARTICULO.toString().trim().toUpperCase(), row);
  });

  const products = pedidos.map(row => {
    const codeCountry = (row['Código country'] || '').toString().trim();
    const codeFrumusa = (row['Codigo frumusa'] || '').toString().trim();
    const desc = (row['Descripción'] || '').toString().trim().toUpperCase();

    let dataMatch = (codeCountry ? dataByNoArti.get(codeCountry.toUpperCase()) : null) ||
                    (codeFrumusa ? dataByNoArti.get(codeFrumusa.toUpperCase()) : null) ||
                    (desc ? dataByDesc.get(desc) : null);

    let cost = 0;
    if (dataMatch && Number(dataMatch['COSTO_UNITARIO']) > 0) {
      cost = Number(dataMatch['COSTO_UNITARIO']);
    } else if (Number(row['Costo unitario'] || row['Costo'] || 0) > 0) {
      cost = Number(row['Costo unitario'] || row['Costo']);
    } else {
      const origFinal = Number(row['Pedido sugerido'] || row['PEDIDO FINAL'] || 0);
      const origCost = Number(row['Costo de pedido'] || 0);
      if (origFinal > 0 && origCost > 0) cost = origCost / origFinal;
    }

    const packMultiple = Number(row['Múltiplo de pedido'] || 1);

    return {
      code_country: codeCountry,
      code_frumusa: codeFrumusa,
      description: row['Descripción'] || (dataMatch ? dataMatch['ARTICULO'] : `SKU ${codeCountry || codeFrumusa}`),
      unit_cost: cost,
      pack_multiple: packMultiple > 0 ? packMultiple : 1,
      category: 'Perecederos'
    };
  });

  const sabadoItems = [];
  let totalSabadoUnits = 0;
  let totalSabadoCost = 0;

  lines.forEach(line => {
    const parts = line.split('\t');
    if (parts.length >= 1) {
      const codeKey = parts[0].trim();
      const boxesStr = parts.length > 1 ? parts[1].trim() : '';
      const totalBoxes = parseFloat(boxesStr.replace(',', '.')) || 0;

      if (totalBoxes > 0) {
        const prod = products.find(p => 
          (p.code_country && p.code_country.toUpperCase() === codeKey.toUpperCase()) ||
          (p.code_frumusa && p.code_frumusa.toUpperCase() === codeKey.toUpperCase())
        ) || {
          code_country: codeKey,
          code_frumusa: codeKey,
          description: `SKU ${codeKey}`,
          pack_multiple: 1,
          unit_cost: 0,
          category: 'Perecederos'
        };

        const mult = Number(prod.pack_multiple || 1);
        const cost = Number(prod.unit_cost || 0);
        const units = totalBoxes * mult;
        const totalCost = units * cost;

        totalSabadoUnits += units;
        totalSabadoCost += totalCost;

        sabadoItems.push({
          codeSku: prod.code_frumusa || codeKey,
          codeCountry: prod.code_country || codeKey,
          codeFrumusa: prod.code_frumusa || codeKey,
          description: prod.description,
          category: prod.category || 'Perecederos',
          boxes: totalBoxes,
          quantity: units,
          unitCost: cost,
          totalCost: totalCost,
          packMultiple: mult
        });
      }
    }
  });

  const now = new Date();
  
  const orderSabado = {
    id: `ORD-SABADO-${Date.now()}`,
    orderNumber: `PED-SAB-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()+2).padStart(2,'0')}-03`,
    day: 'Sábado',
    executionDay: 'Sábado',
    deliveryDay: 'Miércoles',
    status: 'EN_TRANSITO',
    createdAt: now.toISOString(),
    approvedBy: 'Milton Sánchez Gutiérrez',
    totalItems: sabadoItems.length,
    totalBoxes: sabadoItems.reduce((acc, i) => acc + i.boxes, 0),
    totalUnits: totalSabadoUnits,
    totalCost: totalSabadoCost,
    items: sabadoItems
  };

  const dataDir = path.join(__dirname, '..', 'data');
  const ordersFilePath = path.join(dataDir, 'active_orders.json');
  let currentOrders = [];
  if (fs.existsSync(ordersFilePath)) {
    try {
      currentOrders = JSON.parse(fs.readFileSync(ordersFilePath, 'utf8'));
    } catch (e) {}
  }

  // Remove existing Saturday orders if any, and append new order
  currentOrders = currentOrders.filter(o => o.executionDay !== 'Sábado' && o.day !== 'Sábado');
  currentOrders.push(orderSabado);

  fs.writeFileSync(ordersFilePath, JSON.stringify(currentOrders, null, 2), 'utf8');

  console.log('✅ Orden de SÁBADO registrada exitosamente en la base de datos:');
  console.log(`📦 ORDEN SÁBADO (${orderSabado.orderNumber}): ${orderSabado.totalItems} SKUs | ${orderSabado.totalBoxes} cajas | ${orderSabado.totalUnits} und | ₡${orderSabado.totalCost.toLocaleString('es-CR')}`);

  return orderSabado;
}

if (require.main === module) {
  processSaturdayOrder();
}

module.exports = { processSaturdayOrder };
