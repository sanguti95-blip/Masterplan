const fs = require('fs');
const path = require('path');
const { parseLocaleNumber } = require('../server/services/syncService');

const rows = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sheets_raw.json'), 'utf8'));

function getRefinedCategory(desc) {
  const d = (desc || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Preparados, Picados y Valor Agregado
  if (d.includes('ENSALAD') || d.includes('OLLA DE CARNE') || d.includes('CHOP SUEY') || 
      d.includes('PULPA') || d.includes('VEGETALES MIX') || d.includes('BANDEJA MIX') || 
      d.includes('MIXTO') || d.includes('PICADO') || d.includes('PELADO') || d.includes('PREPARAD')) {
    return 'Vegetales y Frutas Preparadas';
  }

  // 2. Abarrotes, Granos y Complementarios
  if (d.includes('TORTILLA') || d.includes('CARBON') || d.includes('CONDIMENTO') || 
      d.includes('CAJETA') || d.includes('LENTEJA') || d.includes('FRIJOL ROJO') || 
      d.includes('FRIJOL NEGRO') || d.includes('AGUA ') || d.includes('LINAZA') || 
      d.includes('COCANA') || d.includes('SNACK') || d.includes('CHICHARRON') || 
      d.includes('CHURRO') || d.includes('MIEL') || d.includes('QUESO') || 
      d.includes('PAN ') || d.includes('SALSA') || d.includes('CHILE DULCE SECO') || 
      d.includes('MANI') || d.includes('SEMILLA') || d.includes('TANELAS')) {
    return 'Abarrotes y Complementarios';
  }

  // 3. Hierbas, Aromáticas y Especias
  if (d.includes('CULANTRO') || d.includes('OREGANO') || d.includes('PEREJIL') || 
      d.includes('ROMERO') || d.includes('TOMILLO') || d.includes('ALBAHACA') || 
      d.includes('HIERBABUENA') || d.includes('HIERBA BUENA') || d.includes('MENTA') || 
      d.includes('LAUREL') || d.includes('ESTRAGON') || d.includes('ENELDO') || 
      d.includes('CEBOLLIN') || d.includes('CEBOLLINO') || d.includes('AJO') || 
      d.includes('ENCHILADO') || d.includes('ZACATE') || d.includes('COYOL') || 
      d.includes('JAMAICA') || d.includes('MORINGA') || d.includes('APASOTE') || 
      d.includes('SALVIA') || d.includes('CANELA') || d.includes('MANZANILLA')) {
    return 'Hierbas y Aromáticas';
  }

  // 4. Hortalizas, Hojas y Hongos
  if (d.includes('LECHUGA') || d.includes('REPOLLO') || d.includes('ESPINACA') || 
      d.includes('ACELGA') || d.includes('APIO') || d.includes('BROCOLI') || 
      d.includes('COLIFLOR') || d.includes('BERRO') || d.includes('KALE') || 
      d.includes('RUCULA') || d.includes('REPOLLITA') || d.includes('MOSTAZA') || 
      d.includes('COLES') || d.includes('HONGO') || d.includes('CHAMPINON') || 
      d.includes('ESPARRAGO') || d.includes('PUERRO') || d.includes('FRIJOL NACIDO') || 
      d.includes('ARVEJA') || d.includes('ALFALFA') || d.includes('MINIVEGETAL') || 
      d.includes('HOJA')) {
    return 'Hortalizas y Hojas';
  }

  // 5. Tubérculos y Raíces
  if (d.includes('PAPA') || d.includes('ZANAHORIA') || d.includes('CEBOLLA') || 
      d.includes('YUCA') || d.includes('CAMOTE') || d.includes('REMOLACHA') || 
      d.includes('RABANO') || d.includes('NAMPI') || d.includes('TIKISQUE') || 
      d.includes('TIQUISQUE') || d.includes('MALANGA') || d.includes('JENGIBRE') || 
      d.includes('JENJIBRE') || d.includes('CURCUMA') || d.includes('ARRACACHE') || 
      d.includes('NAME') || d.includes('PICHICHI')) {
    return 'Tubérculos y Raíces';
  }

  // 6. Vegetales de Fruto
  if (d.includes('TOMATE') || d.includes('CHILE') || d.includes('CHAYOTE') || 
      d.includes('PEPINO') || d.includes('ZUCCHINI') || d.includes('ZUCHINNI') || 
      d.includes('CALABAZA') || d.includes('BERENJENA') || d.includes('AYOTE') || 
      d.includes('VAINA') || d.includes('VAINICA') || d.includes('MAIZ') || 
      d.includes('ELOTE') || d.includes('PIPINIAN') || d.includes('PIPIAN') || 
      d.includes('ZAPALLO') || d.includes('CHILOTE') || d.includes('OKRA')) {
    return 'Vegetales de Fruto';
  }

  // 7. Frutas Frescas
  if (d.includes('PLATANO') || d.includes('BANANO') || d.includes('AGUACATE') || 
      d.includes('PAPAYA') || d.includes('LIMON') || d.includes('MANGA') || 
      d.includes('MANGO') || d.includes('NARANJA') || d.includes('FRESA') || 
      d.includes('PINA') || d.includes('SANDIA') || d.includes('MELON') || 
      d.includes('MANZANA') || d.includes('MANZ ') || d.includes('MANZ.') || 
      d.includes('UVA') || d.includes('PERA') || d.includes('DURAZNO') || 
      d.includes('KIWI') || d.includes('GRANADILLA') || d.includes('MARACUYA') || 
      d.includes('MARACULLA') || d.includes('GUINEO') || d.includes('MANDARINA') || 
      d.includes('MORA') || d.includes('ARANDANO') || d.includes('CIRUELA') || 
      d.includes('COCO') || d.includes('GUANABANA') || d.includes('TAMARINDO') || 
      d.includes('JOCOTE') || d.includes('ZAPOTE') || d.includes('CARAMBOLA') || 
      d.includes('CAS') || d.includes('MAMON') || d.includes('PITAHAYA') || 
      d.includes('GUAYABA') || d.includes('MELOCOTON') || d.includes('NECTARINA') || 
      d.includes('POMELO') || d.includes('PEJIBAYE') || d.includes('HIG') || 
      d.includes('CEREZA') || d.includes('TORONJA')) {
    return 'Frutas Frescas';
  }

  return 'Otros Perecederos';
}

const catCounts = {};
const unclassified = new Set();

rows.forEach(r => {
  const desc = r.ARTICULO || '';
  const cat = getRefinedCategory(desc);
  catCounts[cat] = (catCounts[cat] || 0) + 1;
  if (cat === 'Otros Perecederos') {
    unclassified.add(desc);
  }
});

console.log('Distribución de Filas por Categoría:', catCounts);
console.log('Sin clasificar (Otros Perecederos):', unclassified.size);
console.log(Array.from(unclassified).slice(0, 30));
