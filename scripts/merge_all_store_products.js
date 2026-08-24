const fs = require('fs');
const path = require('path');

// 1. Load current synced_catalog.json
const currentSynced = JSON.parse(fs.readFileSync('data/synced_catalog.json', 'utf8'));

// 2. Load INITIAL_DATA from data.js
const dataJs = fs.readFileSync('data.js', 'utf8');
const loadFn = new Function(dataJs + '; return { INITIAL_DATA };');
const { INITIAL_DATA } = loadFn();

// Category classifier
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

console.log('Current synced catalog SKUs:', currentSynced.length);

const existingCountryCodes = new Set();
const existingFrumusaCodes = new Set();
const existingDescriptions = new Set();

currentSynced.forEach(p => {
  if (p.code_country) existingCountryCodes.add(p.code_country.toString().trim().toUpperCase());
  if (p.code_frumusa) existingFrumusaCodes.add(p.code_frumusa.toString().trim().toUpperCase());
  if (p.description) existingDescriptions.add(p.description.toString().trim().toUpperCase());
});

const mergedCatalog = [...currentSynced];
let addedStoreItems = 0;
const seenNewStoreCodes = new Set();

INITIAL_DATA.forEach(row => {
  const code = (row.NO_ARTI || '').toString().trim();
  const upperCode = code.toUpperCase();
  const desc = (row.ARTICULO || '').toString().trim();
  const upperDesc = desc.toUpperCase();

  if (!code || seenNewStoreCodes.has(upperCode)) return;
  seenNewStoreCodes.add(upperCode);

  const inCatalog = existingCountryCodes.has(upperCode) || 
                    existingFrumusaCodes.has(upperCode) || 
                    existingDescriptions.has(upperDesc);

  if (!inCatalog) {
    const unit = (row.UNIDAD_EQ || 'UD').trim();
    const stock = typeof row.SALDO_ACTUAL === 'number' ? row.SALDO_ACTUAL : (parseFloat(row.SALDO_ACTUAL) || 0);
    const sales = typeof row.CANTIDAD === 'number' ? row.CANTIDAD : (parseFloat(row.CANTIDAD) || 0);
    const cost = typeof row.COSTO_UNITARIO === 'number' ? row.COSTO_UNITARIO : (parseFloat(row.COSTO_UNITARIO) || 0);
    const price = typeof row.PRECIO === 'number' ? row.PRECIO : (parseFloat(row.PRECIO) || 0);
    const category = getProduceCategory(desc);

    const newProduct = {
      code_frumusa: '', // Tienda direct product (sin código Frumusa)
      code_country: code,
      description: desc,
      unit: unit,
      package_multiple: 1,
      min_coverage_units: 0,
      category: category,
      stock_actual: stock,
      sales_period: sales,
      unit_cost: cost,
      unit_price: price,
      merma_units: row.UNIDADES_MERMA || 0,
      merma_cost: row.COSTO_BRUTO_MERMA || 0
    };

    mergedCatalog.push(newProduct);
    addedStoreItems++;
  }
});

console.log(`Added ${addedStoreItems} store-only products without Frumusa code.`);
console.log(`Total consolidated catalog SKUs: ${mergedCatalog.length}`);

// Save to data/synced_catalog.json
fs.writeFileSync('data/synced_catalog.json', JSON.stringify(mergedCatalog, null, 2), 'utf8');

// Update data.js INITIAL_PEDIDOS
const updatedPedidosJs = 'const INITIAL_PEDIDOS = ' + JSON.stringify(mergedCatalog, null, 2) + ';\n';
let dataJsContent = fs.readFileSync('data.js', 'utf8');
dataJsContent = dataJsContent.replace(/const INITIAL_PEDIDOS = [\s\S]*?;\n/, updatedPedidosJs);
fs.writeFileSync('data.js', dataJsContent, 'utf8');

console.log('✅ Catalog successfully updated and saved to data/synced_catalog.json and data.js!');
