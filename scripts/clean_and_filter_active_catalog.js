const fs = require('fs');
const path = require('path');

// 1. Load current 608 items
const currentCatalog = JSON.parse(fs.readFileSync('data/synced_catalog.json', 'utf8'));

// 2. Load INITIAL_DATA from data.js
const dataJs = fs.readFileSync('data.js', 'utf8');
const loadFn = new Function(dataJs + '; return { INITIAL_DATA };');
const { INITIAL_DATA } = loadFn();

// Build activity map from CODISA
const activityMap = new Map();
INITIAL_DATA.forEach(r => {
  const c = (r.NO_ARTI || '').toString().trim().toUpperCase();
  const d = (r.ARTICULO || '').toString().trim().toUpperCase();
  const s = Number(r.CANTIDAD) || 0;
  const stk = Number(r.SALDO_ACTUAL) || 0;
  const merma = Number(r.UNIDADES_MERMA) || 0;
  const cost = Number(r.COSTO_UNITARIO) || 0;
  const price = Number(r.PRECIO) || 0;
  const unit = (r.UNIDAD_EQ || 'UD').trim();

  if (c) activityMap.set(c, { s, stk, merma, cost, price, unit });
  if (d) activityMap.set(d, { s, stk, merma, cost, price, unit });
});

// Category classifier
function getProduceCategory(desc) {
  const d = (desc || '').toUpperCase();
  if (d.includes('CULANTRO') || d.includes('OREGANO') || d.includes('ORÉGANO') || 
      d.includes('PEREJIL') || d.includes('ROMERO') || d.includes('TOMILLO') || 
      d.includes('ALBAHACA') || d.includes('HIERBABUENA') || d.includes('HIERBA BUENA') || 
      d.includes('MENTA') || d.includes('LAUREL') || d.includes('ESTRAGON') || 
      d.includes('ESTRAGÓN') || d.includes('ENELDO') || d.includes('CEBOLLIN') || 
      d.includes('CEBOLLINO') || d.includes('AJO') || d.includes('ENCHILADO') || 
      d.includes('ZACATE') || d.includes('COYOL')) {
    return 'Hierbas y Aromáticas';
  }
  if (d.includes('LECHUGA') || d.includes('REPOLLO') || d.includes('ESPINACA') || 
      d.includes('ACELGA') || d.includes('APIO') || d.includes('BROCOLI') || 
      d.includes('BRÓCOLI') || d.includes('COLIFLOR') || d.includes('BERRO') || 
      d.includes('KALE') || d.includes('RUCULA') || d.includes('RÚCULA') || 
      d.includes('REPOLLITAS') || d.includes('MOSTAZA') || d.includes('COLES') || 
      d.includes('HONGO') || d.includes('ESPARRAGO') || d.includes('ALFALFA') || 
      d.includes('ALCACHOFA') || d.includes('CHINAMPAS')) {
    return 'Hortalizas y Hojas';
  }
  if (d.includes('PAPA') || d.includes('ZANAHORIA') || d.includes('CEBOLLA') || 
      d.includes('YUCA') || d.includes('CAMOTE') || d.includes('REMOLACHA') || 
      d.includes('RABANO') || d.includes('RÁBANO') || d.includes('ÑAMPI') || 
      d.includes('NAMPI') || d.includes('TIKISQUE') || d.includes('MALANGA') || 
      d.includes('JENGIBRE') || d.includes('JENJIBRE') || d.includes('CURCUMA') || 
      d.includes('CÚRCUMA') || d.includes('ARRACACHE') || d.includes('NAME') || 
      d.includes('ÑAME') || d.includes('PICHICHI') || d.includes('PEJIBAYE') || 
      d.includes('PEJIBALLE')) {
    return 'Tubérculos y Raíces';
  }
  if (d.includes('TOMATE') || d.includes('CHILE') || d.includes('CHAYOTE') || 
      d.includes('PEPINO') || d.includes('ZUCCHINI') || d.includes('CALABAZA') || 
      d.includes('BERENJENA') || d.includes('AYOTE') || d.includes('VAINA') || 
      d.includes('VAINICA') || d.includes('MAIZ') || d.includes('MAÍZ') || 
      d.includes('ELOTE') || d.includes('PIPINIAN') || d.includes('PIPIAN') || 
      d.includes('CHILOTE') || d.includes('MINIVEGETAL') || d.includes('MINI VEGETAL') || 
      d.includes('ARVEJA') || d.includes('PALMITO') || d.includes('FRIJOL NACIDO') || 
      d.includes('FRIJOL TIERNO')) {
    return 'Vegetales de Fruto';
  }
  if (d.includes('PLATANO') || d.includes('PLÁTANO') || d.includes('BANANO') || 
      d.includes('AGUACATE') || d.includes('PAPAYA') || d.includes('LIMON') || 
      d.includes('LIMÓN') || d.includes('MANGA') || d.includes('MANGO') || 
      d.includes('NARANJA') || d.includes('FRESA') || d.includes('PINA') || 
      d.includes('PIÑA') || d.includes('SANDIA') || d.includes('SANDÍA') || 
      d.includes('MELON') || d.includes('MELÓN') || d.includes('MANZANA') || 
      d.includes('MANZ') || d.includes('UVA') || d.includes('PERA') || 
      d.includes('DURAZNO') || d.includes('KIWI') || d.includes('GRANADILLA') || 
      d.includes('MARACUYA') || d.includes('MARACUYÁ') || d.includes('GUINEO') || 
      d.includes('MANDARINA') || d.includes('MORA') || d.includes('ARANDANO') || 
      d.includes('ARÁNDANO') || d.includes('CIRUELA') || d.includes('COCO') || 
      d.includes('GUANABANA') || d.includes('TAMARINDO') || d.includes('JOCOTE') || 
      d.includes('ZAPOTE') || d.includes('CARAMBOLA') || d.includes('CAS') || 
      d.includes('MAMON') || d.includes('MAMÓN') || d.includes('PITAHAYA') || 
      d.includes('GUAYABA') || d.includes('POMELO') || d.includes('MELOCOTON') || 
      d.includes('CAIMITO') || d.includes('PIPA') || d.includes('PULPA') || 
      d.includes('FRUTA') || d.includes('ARAND')) {
    return 'Frutas Frescas';
  }
  return 'Otros Perecederos';
}

const cleanActiveCatalog = [];
const discarded = [];

currentCatalog.forEach(item => {
  const cf = (item.code_frumusa || '').toString().trim().toUpperCase();
  const cc = (item.code_country || '').toString().trim().toUpperCase();
  const desc = (item.description || '').toString().trim().toUpperCase();

  const codisaInfo = activityMap.get(cc) || activityMap.get(cf) || activityMap.get(desc);

  const sales = Number(item.sales_period || (codisaInfo ? codisaInfo.s : 0)) || 0;
  const stock = Number(item.stock_actual || (codisaInfo ? codisaInfo.stk : 0)) || 0;
  const merma = Number(item.merma_units || (codisaInfo ? codisaInfo.merma : 0)) || 0;

  const isExcluded = desc.includes('NO SE USA') || 
                     desc.includes('NO USAR') || 
                     desc.includes('BOLSA REUTILIZABLE') || 
                     desc.includes('CARBON EN BOLSA');

  const hasActivity = sales > 0 || stock > 0 || merma > 0;

  if (hasActivity && !isExcluded) {
    const cost = item.unit_cost || (codisaInfo ? codisaInfo.cost : 0) || 0;
    const price = item.unit_price || (codisaInfo ? codisaInfo.price : 0) || 0;
    const unit = item.unit || (codisaInfo ? codisaInfo.unit : 'UD') || 'UD';
    const category = getProduceCategory(item.description);

    cleanActiveCatalog.push({
      ...item,
      category,
      unit,
      unit_cost: cost,
      unit_price: price,
      sales_period: sales,
      stock_actual: stock,
      merma_units: merma
    });
  } else {
    discarded.push({
      code_frumusa: item.code_frumusa,
      code_country: item.code_country,
      description: item.description,
      sales,
      stock,
      reason: isExcluded ? 'Excluido (No usar / Insumo)' : 'Sin movimiento histórico (0 ventas y 0 stock)'
    });
  }
});

console.log(`Catálogo Original: ${currentCatalog.length} SKUs`);
console.log(`Depurados (Sin ventas ni stock en CODISA): ${discarded.length} SKUs`);
console.log(`Catálogo Activo Limpio Resultante: ${cleanActiveCatalog.length} SKUs`);

// Guardar en data/synced_catalog.json
fs.writeFileSync('data/synced_catalog.json', JSON.stringify(cleanActiveCatalog, null, 2), 'utf8');

// Actualizar data.js INITIAL_PEDIDOS
const updatedPedidosJs = 'const INITIAL_PEDIDOS = ' + JSON.stringify(cleanActiveCatalog, null, 2) + ';\n';
let dataJsContent = fs.readFileSync('data.js', 'utf8');
dataJsContent = dataJsContent.replace(/const INITIAL_PEDIDOS = [\s\S]*?;\n/, updatedPedidosJs);
fs.writeFileSync('data.js', dataJsContent, 'utf8');

console.log('✅ Catálogo depurado y persistido en data/synced_catalog.json y data.js!');
