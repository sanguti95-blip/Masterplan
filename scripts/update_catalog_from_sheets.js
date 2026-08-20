const fs = require('fs');
const path = require('path');
const server = require('../server/index');
const db = require('../server/db/pool');
const syncService = require('../server/services/syncService');

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxNLOOjTlzp-WLcIiQXpoxw510xMvu3hgXF1Bec8mvhdVR3Kpi8GVN2VcIFZKnAvH21Cg/exec';

async function updateCatalog() {
  console.log('🔄 Descargando y procesando feed maestro de Google Sheets...');
  const res = await syncService.syncFromGoogleAppsScript(GOOGLE_APPS_SCRIPT_URL);
  console.log('✅ Sincronización completada:', res.log);

  const products = db.memoryStore.products;
  console.log(`📦 Procesando ${products.length} productos actualizados...`);

  // Mostrar ejemplo de Platano
  const platano = products.find(p => p.code_frumusa === '145174' || p.code_country === '145174');
  console.log('🍌 Plátano Primera (145174) en memoria:');
  console.log({
    descripcion: platano.description,
    stock_actual: platano.stock_actual,
    ventas_periodo: platano.sales_period,
    dias_periodo: platano.days_period,
    costo_unitario: platano.unit_cost,
    precio: platano.unit_price,
    transito: platano.transit_qty
  });

  // Guardar archivo JSON persistido del catálogo sincronizado
  const catalogPath = path.join(__dirname, '..', 'data', 'synced_catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify(products, null, 2), 'utf8');
  console.log(`💾 Catálogo sincronizado guardado en ${catalogPath}`);

  process.exit(0);
}

setTimeout(updateCatalog, 1500);
