const fs = require('fs');
const path = require('path');

const rows = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sheets_raw.json'), 'utf8'));

function getComprehensiveCategory(desc) {
  const d = (desc || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Insumos, Bazar y Empaques
  if (d.includes('BOLSA') || d.includes('MECATE') || d.includes('PABILO') || d.includes('EMPAQUE')) {
    return 'Insumos y Empaques';
  }

  // 2. Huevos y Lácteos
  if (d.includes('HUEVO') || d.includes('NATILLA') || d.includes('QUESO') || d.includes('LECHE') || d.includes('MANTEQUILLA') || d.includes('YOGUR')) {
    return 'Huevos y Lácteos';
  }

  // 3. Preparados, Picados y Valor Agregado (Cuarta Gama)
  if (d.includes('ENSALAD') || d.includes('OLLA DE CARNE') || d.includes('CHOP SUEY') || 
      d.includes('PULPA') || d.includes('VEGETALES MIX') || d.includes('BANDEJA MIX') || 
      d.includes('MIXTO') || d.includes('PICADO') || d.includes('PELADO') || d.includes('PREPARAD') ||
      d.includes('ESCABECHE') || d.includes('PICADILLO') || d.includes('ENCURTIDO') || d.includes('CEBICHE') || d.includes('CEVICHE')) {
    return 'Vegetales y Frutas Preparadas';
  }

  // 4. Hierbas, Aromáticas y Especias
  if (d.includes('CULANTRO') || d.includes('OREGANO') || d.includes('PEREJIL') || 
      d.includes('ROMERO') || d.includes('TOMILLO') || d.includes('ALBAHACA') || 
      d.includes('HIERBABUENA') || d.includes('HIERBA BUENA') || d.includes('MENTA') || 
      d.includes('LAUREL') || d.includes('ESTRAGON') || d.includes('ENELDO') || 
      d.includes('CEBOLLIN') || d.includes('CEBOLLINO') || d.includes('AJO') || 
      d.includes('ENCHILADO') || d.includes('ZACATE') || d.includes('COYOL') || 
      d.includes('JAMAICA') || d.includes('MORINGA') || d.includes('APASOTE') || 
      d.includes('SALVIA') || d.includes('CANELA') || d.includes('MANZANILLA') || 
      d.includes('CHIA') || d.includes('CHAN') || d.includes('POLEN') || d.includes('LINAZA')) {
    return 'Hierbas, Aromáticas y Especias';
  }

  // 5. Hortalizas, Hojas y Hongos
  if (d.includes('LECHUGA') || d.includes('REPOLLO') || d.includes('ESPINACA') || 
      d.includes('ACELGA') || d.includes('APIO') || d.includes('BROCOLI') || 
      d.includes('COLIFLOR') || d.includes('BERRO') || d.includes('KALE') || 
      d.includes('RUCULA') || d.includes('REPOLLITA') || d.includes('MOSTAZA') || 
      d.includes('COLES') || d.includes('HONGO') || d.includes('CHAMPINON') || 
      d.includes('ESPARRAGO') || d.includes('PUERRO') || d.includes('FRIJOL NACIDO') || 
      d.includes('ARVEJA') || d.includes('ALFALFA') || d.includes('MINIVEGETAL') || 
      d.includes('PALMITO') || d.includes('HOJA')) {
    return 'Hortalizas y Hojas';
  }

  // 6. Tubérculos y Raíces
  if (d.includes('PAPA') || d.includes('ZANAHORIA') || d.includes('CEBOLLA') || 
      d.includes('YUCA') || d.includes('CAMOTE') || d.includes('REMOLACHA') || 
      d.includes('RABANO') || d.includes('NAMPI') || d.includes('TIKISQUE') || 
      d.includes('TIQUISQUE') || d.includes('MALANGA') || d.includes('JENGIBRE') || 
      d.includes('JENJIBRE') || d.includes('CURCUMA') || d.includes('ARRACACHE') || 
      d.includes('NAME') || d.includes('PICHICHI')) {
    return 'Tubérculos y Raíces';
  }

  // 7. Vegetales de Fruto
  if (d.includes('TOMATE') || d.includes('CHILE') || d.includes('CHAYOTE') || 
      d.includes('PEPINO') || d.includes('ZUCCHINI') || d.includes('ZUCHINNI') || 
      d.includes('CALABAZA') || d.includes('BERENJENA') || d.includes('AYOTE') || 
      d.includes('VAINA') || d.includes('VAINICA') || d.includes('MAIZ') || 
      d.includes('ELOTE') || d.includes('PIPINIAN') || d.includes('PIPIAN') || 
      d.includes('ZAPALLO') || d.includes('CHILOTE') || d.includes('OKRA') || 
      d.includes('TACACO') || d.includes('FRIJOL TIERNO')) {
    return 'Vegetales de Fruto';
  }

  // 8. Frutas Frescas
  if (d.includes('PLATANO') || d.includes('BANANO') || d.includes('AGUACATE') || 
      d.includes('PAPAYA') || d.includes('LIMON') || d.includes('MANGA') || 
      d.includes('MANGO') || d.includes('NARANJA') || d.includes('FRESA') || 
      d.includes('PINA') || d.includes('PIPA') || d.includes('SANDIA') || 
      d.includes('MELON') || d.includes('MANZANA') || d.includes('MANZ ') || 
      d.includes('MANZ.') || d.includes('UVA') || d.includes('PERA') || 
      d.includes('DURAZNO') || d.includes('KIWI') || d.includes('GRANADILLA') || 
      d.includes('MARACUYA') || d.includes('MARACULLA') || d.includes('GUINEO') || 
      d.includes('MANDARINA') || d.includes('MORA') || d.includes('ARANDANO') || 
      d.includes('CIRUELA') || d.includes('COCO') || d.includes('GUANABANA') || 
      d.includes('TAMARINDO') || d.includes('JOCOTE') || d.includes('ZAPOTE') || 
      d.includes('CARAMBOLA') || d.includes('CAS') || d.includes('MAMON') || 
      d.includes('PITAHAYA') || d.includes('GUAYABA') || d.includes('MELOCOTON') || 
      d.includes('NECTARINA') || d.includes('POMELO') || d.includes('PEJIBAYE') || 
      d.includes('HIG') || d.includes('CEREZA') || d.includes('TORONJA') || 
      d.includes('NISPERO') || d.includes('ANONA') || d.includes('FRAMBUESA')) {
    return 'Frutas Frescas';
  }

  // 9. Abarrotes, Granos y Secos
  return 'Abarrotes, Granos y Secos';
}

const catCounts = {};
const catSKUs = {};
const unclassified = new Set();

rows.forEach(r => {
  const desc = r.ARTICULO || '';
  const cat = getComprehensiveCategory(desc);
  catCounts[cat] = (catCounts[cat] || 0) + 1;
  if (!catSKUs[cat]) catSKUs[cat] = new Set();
  catSKUs[cat].add(r.NO_ARTI);
});

console.log('Distribución de Filas por Categoría:');
Object.keys(catCounts).forEach(cat => {
  console.log(`- ${cat}: ${catCounts[cat]} filas, ${catSKUs[cat].size} SKUs únicos`);
});
