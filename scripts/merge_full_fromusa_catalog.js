const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Import produce taxonomy function
function getProduceCategory(description) {
  if (!description) return 'Otros Perecederos';
  const d = description.toUpperCase();
  if (d.includes('CULANTRO') || d.includes('CILANTRO') || d.includes('APIO') || 
      d.includes('PEREJIL') || d.includes('ESPINACA') || d.includes('ALBAHACA') || 
      d.includes('ROMERO') || d.includes('TOMILLO') || d.includes('OREGANO') || 
      d.includes('ORÉGANO') || d.includes('MENTA') || d.includes('ENELDO') || 
      d.includes('HIERBA') || d.includes('HIERBABUENA') || d.includes('LAUREL') || 
      d.includes('ESTRAGON') || d.includes('ESTRAGÓN') || d.includes('SALVIA') || 
      d.includes('ZACATE') || d.includes('COYOLILLO') || d.includes('RUDA')) {
    return 'Hierbas y Aromáticas';
  }
  if (d.includes('LECHUGA') || d.includes('REPOLLO') || d.includes('BROCOLI') || 
      d.includes('BRÓCOLI') || d.includes('COLIFLOR') || d.includes('ACELGA') || 
      d.includes('KALE') || d.includes('BERRO') || d.includes('MOZTAPO') || 
      d.includes('MOSTAZA') || d.includes('RADICCHIO') || d.includes('RUCULA') || 
      d.includes('RÚCULA') || d.includes('ENDIVIA') || d.includes('COL ') || 
      d.includes('COLES') || d.includes('HOJA')) {
    return 'Hortalizas y Hojas';
  }
  if (d.includes('PAPA ') || d.includes('PAPA') || d.includes('PAPAS') || 
      d.includes('CEBOLLA') || d.includes('ZANAHORIA') || d.includes('REMOLACHA') || 
      d.includes('YUCA') || d.includes('CAMOTE') || d.includes('RABANO') || 
      d.includes('RÁBANO') || d.includes('AJO') || d.includes('AJOS') || 
      d.includes('TIQUISQUE') || d.includes('MALANGA') || d.includes('JENGIBRE') || 
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
      d.includes('MANZ.') || d.includes('MANZ ') ||
      d.includes('UVA') || d.includes('PERA') || d.includes('DURAZNO') || 
      d.includes('KIWI') || d.includes('GRANADILLA') || d.includes('MARACUYA') || 
      d.includes('MARACUYÁ') || d.includes('GUINEO') || d.includes('MANDARINA') || 
      d.includes('MORA') || d.includes('ARANDANO') || d.includes('ARÁNDANO') || 
      d.includes('CIRUELA') || d.includes('COCO') || d.includes('GUANABANA') || 
      d.includes('TAMARINDO') || d.includes('JOCOTE') || d.includes('ZAPOTE') || 
      d.includes('CARAMBOLA') || d.includes('CAS') || d.includes('MAMON') || d.includes('MAMÓN') ||
      d.includes('PITAHAYA') || d.includes('GUAYABA') || d.includes('MELOCOTON') || d.includes('NECTARINA') || d.includes('POMELO')) {
    return 'Frutas Frescas';
  }
  return 'Otros Perecederos';
}

function parsePackMultipleFromUnit(unitStr, fallback = 1) {
  if (!unitStr) return fallback;
  const u = unitStr.toString().trim().toUpperCase();
  const cMatch = u.match(/^C(\d+(\.\d+)?)$/);
  if (cMatch) return parseFloat(cMatch[1]);
  const aMatch = u.match(/^A(\d+)$/);
  if (aMatch) return parseInt(aMatch[1], 10);
  return fallback;
}

// 1. Read Excel
const excelPath = path.join(__dirname, '..', 'Recursos', 'Productos_Seleccionados_Fromusa_vs_Tienda.xlsx');
const wb = XLSX.readFile(excelPath);
const excelRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

// 2. Read existing catalog
const catalogPath = path.join(__dirname, '..', 'data', 'synced_catalog.json');
const existingCatalog = fs.existsSync(catalogPath) ? JSON.parse(fs.readFileSync(catalogPath, 'utf8')) : [];

console.log(`Excel contiene ${excelRows.length} registros.`);
console.log(`Catálogo actual contiene ${existingCatalog.length} registros.`);

const finalCatalog = [];
const usedCatalogIndices = new Set();

excelRows.forEach(row => {
  const codeFrumusa = (row['CÓDIGO FROMUSA'] || '').toString().trim();
  const descFrumusa = (row['DESCRIPCIÓN FROMUSA (PROVEEDOR)'] || '').toString().trim();
  const unitFrumusa = (row['UNIDAD FROMUSA'] || '').toString().trim();
  const codeCountryRaw = (row['CÓDIGO TIENDA (CODISA)'] || '').toString().trim();
  const codeCountry = (codeCountryRaw && codeCountryRaw !== '-') ? codeCountryRaw : '';

  // Look for match in existing catalog
  let matchedIndex = -1;
  for (let i = 0; i < existingCatalog.length; i++) {
    if (usedCatalogIndices.has(i)) continue;
    const cat = existingCatalog[i];
    const catF = (cat.code_frumusa || cat.codeFrumusa || '').toString().trim().toUpperCase();
    const catC = (cat.code_country || cat.codeCountry || cat.codeSku || '').toString().trim().toUpperCase();
    const catD = (cat.description || cat.ARTICULO || '').toString().trim().toUpperCase();

    if (codeFrumusa && catF === codeFrumusa.toUpperCase()) { matchedIndex = i; break; }
    if (codeCountry && catC === codeCountry.toUpperCase()) { matchedIndex = i; break; }
    if (codeCountry && catF === codeCountry.toUpperCase()) { matchedIndex = i; break; }
    if (descFrumusa && catD === descFrumusa.toUpperCase()) { matchedIndex = i; break; }
  }

  if (matchedIndex !== -1) {
    usedCatalogIndices.add(matchedIndex);
    const existing = existingCatalog[matchedIndex];
    const pack = existing.pack_multiple || parsePackMultipleFromUnit(unitFrumusa, 1);
    const minCov = existing.min_coverage_qty || Math.round(pack * 2);

    finalCatalog.push({
      ...existing,
      code_frumusa: codeFrumusa || existing.code_frumusa,
      codeFrumusa: codeFrumusa || existing.code_frumusa,
      code_country: codeCountry || existing.code_country || '',
      codeCountry: codeCountry || existing.code_country || '',
      codeSku: codeFrumusa || codeCountry || existing.codeSku,
      description: descFrumusa || existing.description,
      unit_eq: unitFrumusa || existing.unit_eq || 'UD',
      unit_fromusa: unitFrumusa,
      pack_multiple: pack,
      packMultiple: pack,
      min_coverage_qty: minCov,
      minCoverageUnits: minCov,
      safety_stock_units: minCov,
      category: existing.category || getProduceCategory(descFrumusa || existing.description),
      transit_qty: 0,
      activeTransit: 0,
      transit: 0
    });
  } else {
    // New SKU from Frumusa catalog
    const pack = parsePackMultipleFromUnit(unitFrumusa, 1);
    const minCov = Math.max(1, Math.round(pack * 2));
    const cat = getProduceCategory(descFrumusa);

    finalCatalog.push({
      code_frumusa: codeFrumusa,
      codeFrumusa: codeFrumusa,
      code_country: codeCountry,
      codeCountry: codeCountry,
      codeSku: codeFrumusa || codeCountry,
      description: descFrumusa,
      category: cat,
      stock_actual: 0,
      stock: 0,
      SALDO_ACTUAL: 0,
      sales_period: 0,
      ventas: 0,
      CANTIDAD: 0,
      days_period: 60,
      unit_cost: 0,
      cost: 0,
      unit_price: 0,
      transit_qty: 0,
      activeTransit: 0,
      transit: 0,
      unit_eq: unitFrumusa || 'UD',
      unit_fromusa: unitFrumusa,
      pack_multiple: pack,
      packMultiple: pack,
      min_coverage_qty: minCov,
      minCoverageUnits: minCov,
      safety_stock_units: minCov,
      safety_stock_days: 1,
      pedidoFinalOverride: null
    });
  }
});

// Append any existing catalog items that weren't in Excel so we don't lose anything
existingCatalog.forEach((item, idx) => {
  if (!usedCatalogIndices.has(idx)) {
    finalCatalog.push({
      ...item,
      transit_qty: 0,
      activeTransit: 0,
      transit: 0
    });
  }
});

console.log(`Catálogo consolidado total: ${finalCatalog.length} SKUs.`);

// Save to synced_catalog.json
fs.writeFileSync(catalogPath, JSON.stringify(finalCatalog, null, 2), 'utf8');
console.log(`✅ data/synced_catalog.json guardado con ${finalCatalog.length} SKUs.`);

// Update data.js
const dataJsPath = path.join(__dirname, '..', 'data.js');
if (fs.existsSync(dataJsPath)) {
  let dataJs = fs.readFileSync(dataJsPath, 'utf8');
  const initialPedidosArray = finalCatalog.map(item => ({
    'Codigo frumusa': item.code_frumusa,
    'Código country': item.code_country,
    'Descripción': item.description,
    'Categoría': item.category,
    'Stock': item.stock_actual || 0,
    'Transito': 0,
    'Ventas del período': item.sales_period || 0,
    'Días del período': item.days_period || 60,
    'Venta diaria promedio': Number(((item.sales_period || 0) / (item.days_period || 60)).toFixed(2)),
    'Covertura meta': 1,
    'Inventario meta': item.min_coverage_qty || 1,
    'Pedido sugerido': 0,
    'Múltiplo de pedido': item.pack_multiple || 1,
    'PEDIDO FINAL': 0,
    'Costo unitario': item.unit_cost || 0,
    'Costo de pedido': 0,
    'Cobertura minima': item.min_coverage_qty || 1,
    'UNIDAD_EQ': item.unit_eq || 'UD'
  }));

  const regex = /const INITIAL_PEDIDOS = \[[\s\S]*?\];/m;
  const newCode = `const INITIAL_PEDIDOS = ${JSON.stringify(initialPedidosArray, null, 2)};`;
  dataJs = dataJs.replace(regex, newCode);
  fs.writeFileSync(dataJsPath, dataJs, 'utf8');
  console.log(`✅ data.js actualizado con los ${finalCatalog.length} SKUs.`);
}
