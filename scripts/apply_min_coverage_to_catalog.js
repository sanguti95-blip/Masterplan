const fs = require('fs');
const path = require('path');

const proposalPath = path.join(__dirname, '..', 'data', 'proposed_min_coverage.json');
const catalogPath = path.join(__dirname, '..', 'data', 'synced_catalog.json');
const dataJsPath = path.join(__dirname, '..', 'data.js');

const proposals = JSON.parse(fs.readFileSync(proposalPath, 'utf8'));
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const propMap = new Map();
proposals.forEach(p => {
  if (p.code_sku) propMap.set(p.code_sku.toString().trim().toUpperCase(), p);
  if (p.code_frumusa) propMap.set(p.code_frumusa.toString().trim().toUpperCase(), p);
  if (p.code_country) propMap.set(p.code_country.toString().trim().toUpperCase(), p);
});

// Update synced_catalog.json
catalog.forEach(item => {
  const k1 = (item.code_frumusa || '').toString().trim().toUpperCase();
  const k2 = (item.code_country || '').toString().trim().toUpperCase();
  const prop = propMap.get(k1) || propMap.get(k2);
  if (prop) {
    item.min_coverage_qty = prop.proposed_min_qty;
    item.min_coverage = prop.proposed_min_qty;
    item.safety_stock_units = prop.proposed_min_qty;
  } else {
    item.min_coverage_qty = Number(item.pack_multiple || 1);
    item.min_coverage = Number(item.pack_multiple || 1);
    item.safety_stock_units = Number(item.pack_multiple || 1);
  }
});

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
console.log(`✅ ${catalog.length} SKUs actualizados con min_coverage_qty en synced_catalog.json.`);

// Update data.js INITIAL_PEDIDOS
let dataJs = fs.readFileSync(dataJsPath, 'utf8');
dataJs = dataJs.replace(/const INITIAL_PEDIDOS = \[[\s\S]*?\];/m, (match) => {
  try {
    const arr = eval(match.replace('const INITIAL_PEDIDOS =', ''));
    arr.forEach(row => {
      const c1 = (row['Código country'] || '').toString().trim().toUpperCase();
      const c2 = (row['Codigo frumusa'] || '').toString().trim().toUpperCase();
      const prop = propMap.get(c1) || propMap.get(c2);
      if (prop) {
        row['Cobertura minima'] = prop.proposed_min_qty;
        row['Covertura meta'] = prop.proposed_min_qty;
      }
    });
    return `const INITIAL_PEDIDOS = ${JSON.stringify(arr, null, 2)};`;
  } catch(e) {
    console.error('Error in INITIAL_PEDIDOS replace:', e);
    return match;
  }
});

fs.writeFileSync(dataJsPath, dataJs, 'utf8');
console.log('✅ data.js actualizado con Cobertura Mínima en Unidades.');
