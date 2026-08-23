const fs = require('fs');
const path = require('path');

// 1. Clear active_orders.json
const ordersPath = path.join(__dirname, '..', 'data', 'active_orders.json');
fs.writeFileSync(ordersPath, '[]', 'utf8');
console.log('✅ data/active_orders.json vaciado (0 órdenes).');

// 2. Clear transit in synced_catalog.json
const catalogPath = path.join(__dirname, '..', 'data', 'synced_catalog.json');
if (fs.existsSync(catalogPath)) {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  catalog.forEach(item => {
    item.transit = 0;
    item.transit_qty = 0;
  });
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`✅ data/synced_catalog.json actualizado: ${catalog.length} SKUs con tránsito en 0.`);
}

// 3. Clear transit in data.js INITIAL_PEDIDOS
const dataJsPath = path.join(__dirname, '..', 'data.js');
if (fs.existsSync(dataJsPath)) {
  let dataJs = fs.readFileSync(dataJsPath, 'utf8');
  dataJs = dataJs.replace(/const INITIAL_PEDIDOS = \[[\s\S]*?\];/m, (match) => {
    try {
      const arr = eval(match.replace('const INITIAL_PEDIDOS =', ''));
      arr.forEach(row => {
        row['Transito'] = 0;
      });
      return `const INITIAL_PEDIDOS = ${JSON.stringify(arr, null, 2)};`;
    } catch(e) {
      console.error('Error:', e);
      return match;
    }
  });
  fs.writeFileSync(dataJsPath, dataJs, 'utf8');
  console.log('✅ data.js INITIAL_PEDIDOS actualizado con Transito: 0.');
}
