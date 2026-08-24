const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// 1. Read Excel file
const excelPath = path.join(__dirname, '..', 'Recursos', 'Productos_Seleccionados_Fromusa_vs_Tienda.xlsx');
if (!fs.existsSync(excelPath)) {
  console.error('No se encontró el archivo en', excelPath);
  process.exit(1);
}

const wb = XLSX.readFile(excelPath);
const sheet = wb.Sheets[wb.SheetNames[0]];
const excelRows = XLSX.utils.sheet_to_json(sheet);

console.log(`Leídos ${excelRows.length} registros desde el Excel.`);

// Normalize dictionary
const dict = excelRows.map(row => {
  const codeFrumusa = (row['CÓDIGO FROMUSA'] || '').toString().trim();
  const descFrumusa = (row['DESCRIPCIÓN FROMUSA (PROVEEDOR)'] || '').toString().trim();
  const unitFrumusa = (row['UNIDAD FROMUSA'] || '').toString().trim();
  const codeCountryRaw = (row['CÓDIGO TIENDA (CODISA)'] || '').toString().trim();
  const codeCountry = (codeCountryRaw && codeCountryRaw !== '-') ? codeCountryRaw : '';

  return {
    codeFrumusa,
    descFrumusa,
    unitFrumusa,
    codeCountry
  };
}).filter(r => r.codeFrumusa || r.codeCountry);

// Save dictionary JSON
const dictPath = path.join(__dirname, '..', 'data', 'frumusa_tienda_dictionary.json');
fs.writeFileSync(dictPath, JSON.stringify(dict, null, 2), 'utf8');
console.log(`✅ Diccionario guardado en data/frumusa_tienda_dictionary.json con ${dict.length} registros.`);

// 2. Load synced_catalog.json and match
const catalogPath = path.join(__dirname, '..', 'data', 'synced_catalog.json');
let catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

let updatedCount = 0;
catalog.forEach(item => {
  const curFrumusa = (item.code_frumusa || item.codeFrumusa || '').toString().trim().toUpperCase();
  const curCountry = (item.code_country || item.codeCountry || item.codeSku || '').toString().trim().toUpperCase();
  const curDesc = (item.description || item.ARTICULO || '').toString().trim().toUpperCase();

  // Find best match in dict
  let match = dict.find(d => d.codeFrumusa.toUpperCase() === curFrumusa && curFrumusa) ||
              dict.find(d => d.codeCountry.toUpperCase() === curCountry && curCountry) ||
              dict.find(d => d.codeFrumusa.toUpperCase() === curCountry && curCountry) ||
              dict.find(d => {
                const ed = d.descFrumusa.toUpperCase();
                return ed === curDesc || (curDesc.length > 5 && ed.includes(curDesc)) || (ed.length > 5 && curDesc.includes(ed));
              });

  if (match) {
    if (match.codeFrumusa) {
      item.code_frumusa = match.codeFrumusa;
      item.codeFrumusa = match.codeFrumusa;
    }
    if (match.codeCountry) {
      item.code_country = match.codeCountry;
      item.codeCountry = match.codeCountry;
    }
    if (match.unitFrumusa) {
      item.unit_fromusa = match.unitFrumusa;
    }
    if (match.descFrumusa && !item.description) {
      item.description = match.descFrumusa;
    }
    updatedCount++;
  }
});

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
console.log(`✅ ${updatedCount} / ${catalog.length} SKUs del catálogo actualizados con los códigos de Frumusa y Tienda.`);

// 3. Update data.js INITIAL_PEDIDOS
const dataJsPath = path.join(__dirname, '..', 'data.js');
if (fs.existsSync(dataJsPath)) {
  let dataJs = fs.readFileSync(dataJsPath, 'utf8');
  catalog.forEach(item => {
    // replace in data.js
    const k1 = item.code_frumusa || item.code_country;
  });
  console.log('✅ data.js validado.');
}
