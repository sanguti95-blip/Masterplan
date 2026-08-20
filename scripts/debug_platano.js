const https = require('https');
const syncService = require('../server/services/syncService');

const url = 'https://script.google.com/macros/s/AKfycbxNLOOjTlzp-WLcIiQXpoxw510xMvu3hgXF1Bec8mvhdVR3Kpi8GVN2VcIFZKnAvH21Cg/exec';

function fetchRemoteData(u) {
  return new Promise((resolve, reject) => {
    https.get(u, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchRemoteData(res.headers.location));
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function run() {
  const csv = await fetchRemoteData(url);
  const rows = syncService.parseCSV(csv);
  console.log('Total rows parsed:', rows.length);

  const platanoRows = rows.filter(r => {
    const sku = (r.NO_ARTI || r.CODIGO || '').toString().trim();
    const desc = (r.DESCRIPCION || r.ARTICULO || '').toString().toUpperCase();
    return sku === '145174' || desc.includes('PLATANO PRIMERA');
  });

  console.log('Platano rows count:', platanoRows.length);
  console.log('Platano rows detail:');
  console.dir(platanoRows, { depth: null });
}

run().catch(console.error);
