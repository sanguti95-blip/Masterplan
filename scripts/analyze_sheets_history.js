const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { parseCSV, parseLocaleNumber } = require('../server/services/syncService');

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxNLOOjTlzp-WLcIiQXpoxw510xMvu3hgXF1Bec8mvhdVR3Kpi8GVN2VcIFZKnAvH21Cg/exec';

function fetchRemoteData(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchRemoteData(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error('HTTP ' + res.statusCode));
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', err => reject(err));
  });
}

function getProduceCategory(desc) {
  const d = (desc || '').toUpperCase();
  if (d.includes('CULANTRO') || d.includes('OREGANO') || d.includes('ORÉGANO') || 
      d.includes('PEREJIL') || d.includes('ROMERO') || d.includes('TOMILLO') || 
      d.includes('ALBAHACA') || d.includes('HIERBABUENA') || d.includes('MENTA') || 
      d.includes('LAUREL') || d.includes('ESTRAGON') || d.includes('ESTRAGÓN') || 
      d.includes('ENELDO') || d.includes('CEBOLLIN') || d.includes('CEBOLLINO') || 
      d.includes('AJO') || d.includes('ENCHILADO') || d.includes('ZACATE') || d.includes('COYOL')) {
    return 'Hierbas y Aromáticas';
  }
  if (d.includes('LECHUGA') || d.includes('REPOLLO') || d.includes('ESPINACA') || 
      d.includes('ACELGA') || d.includes('APIO') || d.includes('BROCOLI') || 
      d.includes('BRÓCOLI') || d.includes('COLIFLOR') || d.includes('BERRO') || 
      d.includes('KALE') || d.includes('RUCULA') || d.includes('RÚCULA') || 
      d.includes('REPOLLITAS') || d.includes('MOSTAZA') || d.includes('COLES')) {
    return 'Hortalizas y Hojas';
  }
  if (d.includes('PAPA') || d.includes('ZANAHORIA') || d.includes('CEBOLLA') || 
      d.includes('YUCA') || d.includes('CAMOTE') || d.includes('REMOLACHA') || 
      d.includes('RABANO') || d.includes('RÁBANO') || d.includes('ÑAMPI') || 
      d.includes('TIKISQUE') || d.includes('MALANGA') || d.includes('JENGIBRE') || 
      d.includes('CURCUMA') || d.includes('CÚRCUMA') || d.includes('ARRACACHE') || 
      d.includes('NAME') || d.includes('ÑAME') || d.includes('PICHICHI')) {
    return 'Tubérculos y Raíces';
  }
  if (d.includes('TOMATE') || d.includes('CHILE') || d.includes('CHAYOTE') || 
      d.includes('PEPINO') || d.includes('ZUCCHINI') || d.includes('CALABAZA') || 
      d.includes('BERENJENA') || d.includes('AYOTE') || d.includes('VAINA') || 
      d.includes('VAINICA') || d.includes('MAIZ') || d.includes('MAÍZ') || 
      d.includes('ELOTE') || d.includes('PIPINIAN') || d.includes('PIPIAN')) {
    return 'Vegetales de Fruto';
  }
  if (d.includes('PLATANO') || d.includes('PLÁTANO') || d.includes('BANANO') || 
      d.includes('AGUACATE') || d.includes('PAPAYA') || d.includes('LIMON') || 
      d.includes('LIMÓN') || d.includes('MANGA') || d.includes('MANGO') || 
      d.includes('NARANJA') || d.includes('FRESA') || d.includes('PINA') || 
      d.includes('PIÑA') || d.includes('SANDIA') || d.includes('SANDÍA') || 
      d.includes('MELON') || d.includes('MELÓN') || d.includes('MANZANA') || 
      d.includes('UVA') || d.includes('PERA') || d.includes('DURAZNO') || 
      d.includes('KIWI') || d.includes('GRANADILLA') || d.includes('MARACUYA') || 
      d.includes('MARACUYÁ') || d.includes('GUINEO') || d.includes('MANDARINA') || 
      d.includes('MORA') || d.includes('ARANDANO') || d.includes('ARÁNDANO') || 
      d.includes('CIRUELA') || d.includes('COCO') || d.includes('GUANABANA') || 
      d.includes('TAMARINDO') || d.includes('JOCOTE') || d.includes('ZAPOTE') || 
      d.includes('CARAMBOLA') || d.includes('CAS') || d.includes('MAMON') || d.includes('MAMÓN') ||
      d.includes('PITAHAYA') || d.includes('GUAYABA')) {
    return 'Frutas Frescas';
  }
  return 'Otros Perecederos';
}

function parseDateKey(dateStr) {
  if (!dateStr) return 'UNKNOWN';
  const parts = dateStr.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}`;
    } else {
      // DD/MM/YYYY
      const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${yr}-${parts[1].padStart(2, '0')}`;
    }
  }
  return dateStr;
}

async function run() {
  const csv = await fetchRemoteData(GOOGLE_APPS_SCRIPT_URL);
  const rows = parseCSV(csv);
  
  // Guardar copia local del CSV crudo para no tener que descargarlo repetidamente
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'sheets_raw.json'), JSON.stringify(rows, null, 2), 'utf8');

  console.log(`Total rows: ${rows.length}`);
  
  // Agrupar meses
  const months = new Set();
  const categoryStats = {};
  const productStats = {};

  rows.forEach(row => {
    const monthKey = parseDateKey(row.FECHA_PROCESO);
    months.add(monthKey);

    const sku = (row.NO_ARTI || '').trim();
    const desc = (row.ARTICULO || '').trim();
    const cat = getProduceCategory(desc);

    const qty = parseLocaleNumber(row.CANTIDAD, 0);
    const monto = parseLocaleNumber(row.MONTO_BRUTO, 0);
    const costoUnit = parseLocaleNumber(row.COSTO_UNITARIO, 0);
    const precio = parseLocaleNumber(row.PRECIO, 0);
    const mermaQty = parseLocaleNumber(row.UNIDADES_MERMA, 0);
    const mermaMonto = parseLocaleNumber(row.COSTO_BRUTO_MERMA, 0);
    const saldo = parseLocaleNumber(row.SALDO_ACTUAL, 0);

    // Categoria
    if (!categoryStats[cat]) categoryStats[cat] = { totalMonto: 0, totalQty: 0, totalMermaMonto: 0, totalMermaQty: 0, months: {}, skus: new Set() };
    categoryStats[cat].totalMonto += monto;
    categoryStats[cat].totalQty += qty;
    categoryStats[cat].totalMermaMonto += mermaMonto;
    categoryStats[cat].totalMermaQty += mermaQty;
    categoryStats[cat].skus.add(sku);

    if (!categoryStats[cat].months[monthKey]) {
      categoryStats[cat].months[monthKey] = { monto: 0, qty: 0, mermaMonto: 0, mermaQty: 0 };
    }
    categoryStats[cat].months[monthKey].monto += monto;
    categoryStats[cat].months[monthKey].qty += qty;
    categoryStats[cat].months[monthKey].mermaMonto += mermaMonto;
    categoryStats[cat].months[monthKey].mermaQty += mermaQty;

    // Producto
    if (!productStats[sku]) {
      productStats[sku] = {
        sku,
        description: desc,
        category: cat,
        unit: row.UNIDAD_EQ || 'UD',
        lastPrice: precio,
        lastCost: costoUnit,
        lastStock: saldo,
        totalMonto: 0,
        totalQty: 0,
        totalMermaMonto: 0,
        totalMermaQty: 0,
        months: {}
      };
    }
    const prod = productStats[sku];
    prod.totalMonto += monto;
    prod.totalQty += qty;
    prod.totalMermaMonto += mermaMonto;
    prod.totalMermaQty += mermaQty;
    if (precio > 0) prod.lastPrice = precio;
    if (costoUnit > 0) prod.lastCost = costoUnit;
    prod.lastStock = Math.max(prod.lastStock, saldo);

    if (!prod.months[monthKey]) {
      prod.months[monthKey] = { monto: 0, qty: 0, mermaMonto: 0, mermaQty: 0, saldo: 0, price: precio, cost: costoUnit };
    }
    prod.months[monthKey].monto += monto;
    prod.months[monthKey].qty += qty;
    prod.months[monthKey].mermaMonto += mermaMonto;
    prod.months[monthKey].mermaQty += mermaQty;
    prod.months[monthKey].saldo = Math.max(prod.months[monthKey].saldo, saldo);
  });

  const sortedMonths = Array.from(months).sort();
  console.log('Meses detectados:', sortedMonths);

  console.log('\n--- RESUMEN POR CATEGORÍA ---');
  Object.keys(categoryStats).forEach(cat => {
    const c = categoryStats[cat];
    console.log(`${cat}: ${c.skus.size} SKUs, Ventas Totales: ₡${Math.round(c.totalMonto).toLocaleString()}, Cantidad: ${Math.round(c.totalQty).toLocaleString()}, Merma: ₡${Math.round(c.totalMermaMonto).toLocaleString()}`);
  });

  console.log(`\nTotal Productos Únicos: ${Object.keys(productStats).length}`);
}

run().catch(console.error);
