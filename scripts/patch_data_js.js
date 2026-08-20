const fs = require('fs');
const path = require('path');

const syncedCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'synced_catalog.json'), 'utf8'));
const dataJsPath = path.join(__dirname, '..', 'data.js');

// Map by SKU
const syncMap = new Map();
syncedCatalog.forEach(item => {
  const k1 = (item.code_country || '').toString().trim().toUpperCase();
  const k2 = (item.code_frumusa || '').toString().trim().toUpperCase();
  if (k1) syncMap.set(k1, item);
  if (k2) syncMap.set(k2, item);
});

// Update data.js INITIAL_DATA and INITIAL_PEDIDOS
let content = fs.readFileSync(dataJsPath, 'utf8');

// Update INITIAL_DATA
content = content.replace(/const INITIAL_DATA = \[[\s\S]*?\];/m, (match) => {
  try {
    const rawArr = eval(match.replace('const INITIAL_DATA =', ''));
    rawArr.forEach(row => {
      const sku = (row.NO_ARTI || '').toString().trim().toUpperCase();
      const synced = syncMap.get(sku);
      if (synced) {
        row.SALDO_ACTUAL = synced.stock_actual;
        row.CANTIDAD = synced.sales_period;
        row.COSTO_UNITARIO = synced.unit_cost;
        if (synced.unit_price) row.PRECIO = synced.unit_price;
      }
    });
    return `const INITIAL_DATA = ${JSON.stringify(rawArr, null, 2)};`;
  } catch(e) {
    console.error('Error replacing INITIAL_DATA:', e);
    return match;
  }
});

// Update INITIAL_PEDIDOS
content = content.replace(/const INITIAL_PEDIDOS = \[[\s\S]*?\];/m, (match) => {
  try {
    const rawArr = eval(match.replace('const INITIAL_PEDIDOS =', ''));
    rawArr.forEach(row => {
      const c1 = (row['Código country'] || '').toString().trim().toUpperCase();
      const c2 = (row['Codigo frumusa'] || '').toString().trim().toUpperCase();
      const synced = syncMap.get(c1) || syncMap.get(c2);
      if (synced) {
        row['Stock'] = synced.stock_actual;
        row['Ventas del período'] = synced.sales_period;
        row['Costo unitario'] = synced.unit_cost;
        row['Transito'] = synced.transit_qty;
      }
    });
    return `const INITIAL_PEDIDOS = ${JSON.stringify(rawArr, null, 2)};`;
  } catch(e) {
    console.error('Error replacing INITIAL_PEDIDOS:', e);
    return match;
  }
});

fs.writeFileSync(dataJsPath, content, 'utf8');
console.log('✅ data.js actualizado con datos sincronizados de Agosto 2026.');
