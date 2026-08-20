const fs = require('fs');
const path = require('path');
const db = require('../server/db/pool');
const syncService = require('../server/services/syncService');

async function analyzeHistoricalData() {
  console.log('📊 Analizando histórico de ventas y calculando propuesta de Cobertura Mínima en Unidades...');
  
  // Cargar catálogo sincronizado
  const catalogPath = path.join(__dirname, '..', 'data', 'synced_catalog.json');
  let products = [];
  if (fs.existsSync(catalogPath)) {
    products = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  } else {
    products = db.memoryStore.products || [];
  }

  console.log(`Analizando ${products.length} productos...`);

  const proposals = products.map(prod => {
    const sku = prod.code_frumusa || prod.code_country || prod.codeSku;
    const desc = prod.description || '';
    const cat = prod.category || 'General';
    const pack = Number(prod.pack_multiple || 1);
    const stock = Number(prod.stock_actual || 0);
    const sales = Number(prod.sales_period || 0);
    const vdp = prod.days_in_month_cut ? (sales / prod.days_in_month_cut) : (sales / 19);
    
    // Regla de propuesta de Cobertura Mínima en Unidades:
    // Para perecederos de alta rotación: buffer de 1.5 a 2 días de VDP redondeado al múltiplo de bulto
    // Para baja rotación: mínimo 1 bulto
    let targetDays = 1.5;
    if (vdp > 100) targetDays = 1.5;
    else if (vdp > 30) targetDays = 2.0;
    else if (vdp > 5) targetDays = 2.5;
    else targetDays = 3.0;

    let rawUnits = vdp * targetDays;
    // Redondear al múltiplo de bulto más cercano o mínimo 1 bulto
    let proposedBoxes = Math.max(1, Math.ceil(rawUnits / pack));
    let proposedMinQty = proposedBoxes * pack;

    return {
      code_sku: sku,
      code_frumusa: prod.code_frumusa,
      code_country: prod.code_country,
      description: desc,
      category: cat,
      pack_multiple: pack,
      vdp: parseFloat(vdp.toFixed(2)),
      stock_actual: stock,
      proposed_min_qty: proposedMinQty,
      proposed_boxes: proposedBoxes,
      equivalent_days: vdp > 0 ? parseFloat((proposedMinQty / vdp).toFixed(1)) : 0
    };
  });

  // Guardar propuesta en JSON
  const proposalPath = path.join(__dirname, '..', 'data', 'proposed_min_coverage.json');
  fs.writeFileSync(proposalPath, JSON.stringify(proposals, null, 2), 'utf8');
  console.log(`✅ Propuesta generada y guardada en ${proposalPath}`);

  // Mostrar Top 20 productos de mayor rotación con su propuesta
  proposals.sort((a, b) => b.vdp - a.vdp);
  console.log('\nTop 15 Artículos con mayor rotación y su propuesta de Cobertura Mínima (Cantidad):');
  console.table(proposals.slice(0, 15).map(p => ({
    SKU: p.code_sku,
    Articulo: p.description.substring(0, 25),
    VDP: p.vdp,
    Bulto: p.pack_multiple,
    'Cob. Mín (Und)': p.proposed_min_qty,
    'Cajas Propuestas': p.proposed_boxes,
    'Días Equiv.': p.equivalent_days
  })));
}

analyzeHistoricalData().catch(console.error);
