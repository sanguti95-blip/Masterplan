const fs = require('fs');
const path = require('path');
const { parseCSV, parseLocaleNumber } = require('../server/services/syncService');

const rows = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sheets_raw.json'), 'utf8'));

console.log('Sample row with all fields:', rows[0]);

// Check date formats and all months
const months = {};
rows.forEach(r => {
  const f = r.FECHA_PROCESO;
  if (!months[f]) months[f] = 0;
  months[f]++;
});
console.log('Date distribution in raw CSV:', months);
