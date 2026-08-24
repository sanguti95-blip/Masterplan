const fs = require('fs');
const path = require('path');

// 1. Load current 608 SKUs
const catalog = JSON.parse(fs.readFileSync('data/synced_catalog.json', 'utf8'));

// 2. Load INITIAL_DATA from data.js
const dataJs = fs.readFileSync('data.js', 'utf8');
const loadFn = new Function(dataJs + '; return { INITIAL_DATA };');
const { INITIAL_DATA } = loadFn();

// Build map of activity in CODISA
const activityByCode = new Map();
const activityByDesc = new Map();

INITIAL_DATA.forEach(row => {
  const code = (row.NO_ARTI || '').toString().trim().toUpperCase();
  const desc = (row.ARTICULO || '').toString().trim().toUpperCase();
  const sales = Number(row.CANTIDAD) || 0;
  const stock = Number(row.SALDO_ACTUAL) || 0;
  const merma = Number(row.UNIDADES_MERMA) || 0;
  const cost = Number(row.COSTO_UNITARIO) || 0;

  const info = { sales, stock, merma, cost };

  if (code) activityByCode.set(code, info);
  if (desc) activityByDesc.set(desc, info);
});

// Analyze each item in the 608 catalog
const activeItems = [];
const zeroMovementItems = [];
const nonProduceSuspicious = [];

catalog.forEach(item => {
  const codeF = (item.code_frumusa || '').toString().trim().toUpperCase();
  const codeC = (item.code_country || '').toString().trim().toUpperCase();
  const desc = (item.description || '').toString().trim().toUpperCase();

  const codisaInfo = activityByCode.get(codeC) || activityByCode.get(codeF) || activityByDesc.get(desc);

  const sales = Number(item.sales_period || (codisaInfo ? codisaInfo.sales : 0)) || 0;
  const stock = Number(item.stock_actual || (codisaInfo ? codisaInfo.stock : 0)) || 0;
  const merma = Number(item.merma_units || (codisaInfo ? codisaInfo.merma : 0)) || 0;

  const hasActivity = sales > 0 || stock > 0 || merma > 0;

  if (hasActivity) {
    activeItems.push({
      ...item,
      sales_period: sales,
      stock_actual: stock,
      merma_units: merma
    });
  } else {
    zeroMovementItems.push({
      code_frumusa: item.code_frumusa,
      code_country: item.code_country,
      description: item.description,
      sales,
      stock,
      hasFrumusaCode: Boolean(item.code_frumusa)
    });
  }
});

console.log('=== AUDITORÍA DE MOVIMIENTO Y ACTIVIDAD CODISA ===');
console.log(`Total SKUs en catálogo actual: ${catalog.length}`);
console.log(`SKUs con Actividad Real (Ventas > 0, Stock > 0 o Merma): ${activeItems.length}`);
console.log(`SKUs sin movimiento (Venta = 0, Stock = 0): ${zeroMovementItems.length}`);

console.log('\n--- Desglose de SKUs con Actividad (${activeItems.length}) ---');
const withBothCodes = activeItems.filter(i => i.code_frumusa && i.code_country).length;
const onlyFromusa = activeItems.filter(i => i.code_frumusa && !i.code_country).length;
const onlyStore = activeItems.filter(i => !i.code_frumusa && i.code_country).length;
console.log(`- Con código Frumusa + Tienda: ${withBothCodes}`);
console.log(`- Solo catálogo Frumusa (pedido a proveedor): ${onlyFromusa}`);
console.log(`- Solo Tienda (con ventas/stock activo en CODISA): ${onlyStore}`);

console.log('\n--- Muestra de 15 SKUs Sin Movimiento (Candidatos a depurar) ---');
console.log(JSON.stringify(zeroMovementItems.slice(0, 15), null, 2));
