const fs = require('fs');
const path = require('path');

const rows = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sheets_raw.json'), 'utf8'));
const synced = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'synced_catalog.json'), 'utf8'));

// Check what descriptions exist in 'Otros Perecederos'
const { parseCSV, parseLocaleNumber } = require('../server/services/syncService');

const otros = new Set();
rows.forEach(r => {
  const desc = r.ARTICULO || '';
  const d = desc.toUpperCase();
  // Check if it matched any produce category
  const isHierba = (d.includes('CULANTRO') || d.includes('OREGANO') || d.includes('ORÉGANO') || 
      d.includes('PEREJIL') || d.includes('ROMERO') || d.includes('TOMILLO') || 
      d.includes('ALBAHACA') || d.includes('HIERBABUENA') || d.includes('MENTA') || 
      d.includes('LAUREL') || d.includes('ESTRAGON') || d.includes('ESTRAGÓN') || 
      d.includes('ENELDO') || d.includes('CEBOLLIN') || d.includes('CEBOLLINO') || 
      d.includes('AJO') || d.includes('ENCHILADO') || d.includes('ZACATE') || d.includes('COYOL'));
  const isHortaliza = (d.includes('LECHUGA') || d.includes('REPOLLO') || d.includes('ESPINACA') || 
      d.includes('ACELGA') || d.includes('APIO') || d.includes('BROCOLI') || 
      d.includes('BRÓCOLI') || d.includes('COLIFLOR') || d.includes('BERRO') || 
      d.includes('KALE') || d.includes('RUCULA') || d.includes('RÚCULA') || 
      d.includes('REPOLLITAS') || d.includes('MOSTAZA') || d.includes('COLES'));
  const isTuberculo = (d.includes('PAPA') || d.includes('ZANAHORIA') || d.includes('CEBOLLA') || 
      d.includes('YUCA') || d.includes('CAMOTE') || d.includes('REMOLACHA') || 
      d.includes('RABANO') || d.includes('RÁBANO') || d.includes('ÑAMPI') || 
      d.includes('TIKISQUE') || d.includes('MALANGA') || d.includes('JENGIBRE') || 
      d.includes('CURCUMA') || d.includes('CÚRCUMA') || d.includes('ARRACACHE') || 
      d.includes('NAME') || d.includes('ÑAME') || d.includes('PICHICHI'));
  const isVegFruto = (d.includes('TOMATE') || d.includes('CHILE') || d.includes('CHAYOTE') || 
      d.includes('PEPINO') || d.includes('ZUCCHINI') || d.includes('CALABAZA') || 
      d.includes('BERENJENA') || d.includes('AYOTE') || d.includes('VAINA') || 
      d.includes('VAINICA') || d.includes('MAIZ') || d.includes('MAÍZ') || 
      d.includes('ELOTE') || d.includes('PIPINIAN') || d.includes('PIPIAN'));
  const isFruta = (d.includes('PLATANO') || d.includes('PLÁTANO') || d.includes('BANANO') || 
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
      d.includes('PITAHAYA') || d.includes('GUAYABA'));

  if (!isHierba && !isHortaliza && !isTuberculo && !isVegFruto && !isFruta) {
    otros.add(desc);
  }
});

console.log('Total in Otros Perecederos / Abarrotes:', otros.size);
console.log('Sample Otros:', Array.from(otros).slice(0, 40));
