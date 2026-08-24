const fs = require('fs');
const path = require('path');

const dict = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'frumusa_tienda_dictionary.json'), 'utf8'));
const dataJsPath = path.join(__dirname, '..', 'data.js');

let dataJs = fs.readFileSync(dataJsPath, 'utf8');

// Parse INITIAL_PEDIDOS from data.js
const regex = /const INITIAL_PEDIDOS = (\[[\s\S]*?\]);/m;
const match = dataJs.match(regex);

if (match) {
  const initialPedidos = eval(match[1]);
  let updated = 0;

  initialPedidos.forEach(item => {
    const k1 = (item['Codigo frumusa'] || '').toString().trim().toUpperCase();
    const k2 = (item['Código country'] || '').toString().trim().toUpperCase();
    const desc = (item['Descripción'] || '').toString().trim().toUpperCase();

    const found = dict.find(d => d.codeFrumusa.toUpperCase() === k1 && k1) ||
                  dict.find(d => d.codeCountry.toUpperCase() === k2 && k2) ||
                  dict.find(d => d.codeFrumusa.toUpperCase() === k2 && k2) ||
                  dict.find(d => {
                    const ed = d.descFrumusa.toUpperCase();
                    return ed === desc || (desc.length > 5 && ed.includes(desc)) || (ed.length > 5 && desc.includes(ed));
                  });

    if (found) {
      if (found.codeFrumusa) item['Codigo frumusa'] = found.codeFrumusa;
      if (found.codeCountry) item['Código country'] = found.codeCountry;
      if (found.descFrumusa && !item['Descripción']) item['Descripción'] = found.descFrumusa;
      updated++;
    }
    item['Transito'] = 0;
  });

  const newCode = `const INITIAL_PEDIDOS = ${JSON.stringify(initialPedidos, null, 2)};`;
  dataJs = dataJs.replace(regex, newCode);
  fs.writeFileSync(dataJsPath, dataJs, 'utf8');
  console.log(`✅ data.js actualizado con ${updated} SKUs mapeados con el diccionario oficial Frumusa vs Tienda.`);
}
