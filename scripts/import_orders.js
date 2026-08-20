const fs = require('fs');
const path = require('path');
const db = require('../server/db/pool');

function processAndSave() {
  const tsvPath = path.join(__dirname, 'orders_raw.tsv');
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
      description: row['Descripción'] || (dataMatch ? dataMatch['ARTICULO'] : `SKU ${codeFrumusa}`),
      unit_cost: cost,
      pack_multiple: packMultiple > 0 ? packMultiple : 1,
      category: 'Perecederos'
    };
  });

  const juevesItems = [];
  const viernesItems = [];

  let totalJuevesUnits = 0;
  let totalViernesUnits = 0;
  let totalJuevesCost = 0;
  let totalViernesCost = 0;

  lines.forEach(line => {
    const parts = line.split('\t');
    if (parts.length >= 3) {
      const codeCountry = parts[0].trim();
      const codeFrumusa = parts[1].trim();
      const totalBoxes = parseFloat(parts[2].replace(',', '.')) || 0;

      if (totalBoxes > 0) {
        const prod = products.find(p => 
          (p.code_frumusa && p.code_frumusa.toUpperCase() === codeFrumusa.toUpperCase()) ||
          (p.code_country && p.code_country.toUpperCase() === codeCountry.toUpperCase())
        ) || {
          description: `SKU ${codeFrumusa}`,
          pack_multiple: 1,
          unit_cost: 0,
          category: 'Perecederos'
        };

        const mult = Number(prod.pack_multiple || 1);
        const cost = Number(prod.unit_cost || 0);

        // Split boxes 50 / 50 between Jueves and Viernes
        const boxesJueves = Math.ceil(totalBoxes / 2);
        const boxesViernes = totalBoxes - boxesJueves;

        const unitsJueves = boxesJueves * mult;
        const unitsViernes = boxesViernes * mult;

        const costJueves = unitsJueves * cost;
        const costViernes = unitsViernes * cost;

        if (boxesJueves > 0) {
          totalJuevesUnits += unitsJueves;
          totalJuevesCost += costJueves;
          juevesItems.push({
            codeSku: codeFrumusa,
            codeCountry: codeCountry,
            codeFrumusa: codeFrumusa,
            description: prod.description,
            category: prod.category,
            boxes: boxesJueves,
            quantity: unitsJueves,
            unitCost: cost,
            totalCost: costJueves,
            packMultiple: mult
          });
        }

        if (boxesViernes > 0) {
          totalViernesUnits += unitsViernes;
          totalViernesCost += costViernes;
          viernesItems.push({
            codeSku: codeFrumusa,
            codeCountry: codeCountry,
            codeFrumusa: codeFrumusa,
            description: prod.description,
            category: prod.category,
            boxes: boxesViernes,
            quantity: unitsViernes,
            unitCost: cost,
            totalCost: costViernes,
            packMultiple: mult
          });
        }
      }
    }
  });

  const now = new Date();
  
  const orderJueves = {
    id: `ORD-JUEVES-${Date.now()}`,
    orderNumber: `PED-JUE-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-01`,
    day: 'Jueves',
    executionDay: 'Jueves',
    deliveryDay: 'Martes',
    status: 'EN_TRANSITO',
    createdAt: now.toISOString(),
    approvedBy: 'Milton Sánchez Gutiérrez',
    totalItems: juevesItems.length,
    totalBoxes: juevesItems.reduce((acc, i) => acc + i.boxes, 0),
    totalUnits: totalJuevesUnits,
    totalCost: totalJuevesCost,
    items: juevesItems
  };

  const orderViernes = {
    id: `ORD-VIERNES-${Date.now() + 1}`,
    orderNumber: `PED-VIE-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()+1).padStart(2,'0')}-02`,
    day: 'Viernes',
    executionDay: 'Viernes',
    deliveryDay: 'Miércoles',
    status: 'EN_TRANSITO',
    createdAt: new Date(Date.now() + 1000).toISOString(),
    approvedBy: 'Milton Sánchez Gutiérrez',
    totalItems: viernesItems.length,
    totalBoxes: viernesItems.reduce((acc, i) => acc + i.boxes, 0),
    totalUnits: totalViernesUnits,
    totalCost: totalViernesCost,
    items: viernesItems
  };

  db.memoryStore.orders = [orderJueves, orderViernes];

  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'active_orders.json'), JSON.stringify(db.memoryStore.orders, null, 2), 'utf8');

  console.log('✅ Órdenes registradas exitosamente en la base de datos:');
  console.log(`📦 ORDEN JUEVES (${orderJueves.orderNumber}): ${orderJueves.totalItems} SKUs | ${orderJueves.totalBoxes} cajas | ${orderJueves.totalUnits} und | ₡${orderJueves.totalCost.toLocaleString('es-CR')}`);
  console.log(`📦 ORDEN VIERNES (${orderViernes.orderNumber}): ${orderViernes.totalItems} SKUs | ${orderViernes.totalBoxes} cajas | ${orderViernes.totalUnits} und | ₡${orderViernes.totalCost.toLocaleString('es-CR')}`);

  return { orderJueves, orderViernes };
}

if (require.main === module) {
  processAndSave();
}

module.exports = { processAndSave };
