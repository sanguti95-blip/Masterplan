const fs = require('fs');
const path = require('path');

function getProduceCategory(desc) {
  const d = (desc || '').toUpperCase();

  // 1. Hierbas y Aromáticas
  if (d.includes('CULANTRO') || d.includes('OREGANO') || d.includes('ORÉGANO') || 
      d.includes('PEREJIL') || d.includes('ROMERO') || d.includes('TOMILLO') || 
      d.includes('ALBAHACA') || d.includes('HIERBABUENA') || d.includes('MENTA') || 
      d.includes('LAUREL') || d.includes('ESTRAGON') || d.includes('ESTRAGÓN') || 
      d.includes('ENELDO') || d.includes('CEBOLLIN') || d.includes('CEBOLLINO') || 
      d.includes('AJO') || d.includes('ENCHILADO') || d.includes('ZACATE') || d.includes('COYOL')) {
    return 'Hierbas y Aromáticas';
  }

  // 2. Hortalizas y Hojas
  if (d.includes('LECHUGA') || d.includes('REPOLLO') || d.includes('ESPINACA') || 
      d.includes('ACELGA') || d.includes('APIO') || d.includes('BROCOLI') || 
      d.includes('BRÓCOLI') || d.includes('COLIFLOR') || d.includes('BERRO') || 
      d.includes('KALE') || d.includes('RUCULA') || d.includes('RÚCULA') || 
      d.includes('REPOLLITAS') || d.includes('MOSTAZA') || d.includes('COLES')) {
    return 'Hortalizas y Hojas';
  }

  // 3. Tubérculos y Raíces
  if (d.includes('PAPA') || d.includes('ZANAHORIA') || d.includes('CEBOLLA') || 
      d.includes('YUCA') || d.includes('CAMOTE') || d.includes('REMOLACHA') || 
      d.includes('RABANO') || d.includes('RÁBANO') || d.includes('ÑAMPI') || 
      d.includes('TIKISQUE') || d.includes('MALANGA') || d.includes('JENGIBRE') || 
      d.includes('CURCUMA') || d.includes('CÚRCUMA') || d.includes('ARRACACHE') || 
      d.includes('NAME') || d.includes('ÑAME') || d.includes('PICHICHI')) {
    return 'Tubérculos y Raíces';
  }

  // 4. Vegetales de Fruto
  if (d.includes('TOMATE') || d.includes('CHILE') || d.includes('CHAYOTE') || 
      d.includes('PEPINO') || d.includes('ZUCCHINI') || d.includes('CALABAZA') || 
      d.includes('BERENJENA') || d.includes('AYOTE') || d.includes('VAINA') || 
      d.includes('VAINICA') || d.includes('MAIZ') || d.includes('MAÍZ') || 
      d.includes('ELOTE') || d.includes('PIPINIAN') || d.includes('PIPIAN')) {
    return 'Vegetales de Fruto';
  }

  // 5. Frutas Frescas
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

// 1. Actualizar synced_catalog.json
const catalogPath = path.join(__dirname, '..', 'data', 'synced_catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const catCounts = {};
catalog.forEach(item => {
  item.category = getProduceCategory(item.description || item.ARTICULO || '');
  catCounts[item.category] = (catCounts[item.category] || 0) + 1;
});

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
console.log('✅ Categorías asignadas en synced_catalog.json:', catCounts);

// 2. Actualizar data.js INITIAL_PEDIDOS
const dataJsPath = path.join(__dirname, '..', 'data.js');
let dataJs = fs.readFileSync(dataJsPath, 'utf8');
dataJs = dataJs.replace(/const INITIAL_PEDIDOS = \[[\s\S]*?\];/m, (match) => {
  try {
    const arr = eval(match.replace('const INITIAL_PEDIDOS =', ''));
    arr.forEach(row => {
      row['Categoría'] = getProduceCategory(row['Descripción'] || '');
    });
    return `const INITIAL_PEDIDOS = ${JSON.stringify(arr, null, 2)};`;
  } catch(e) {
    console.error('Error:', e);
    return match;
  }
});
fs.writeFileSync(dataJsPath, dataJs, 'utf8');
console.log('✅ Categorías asignadas en data.js.');
