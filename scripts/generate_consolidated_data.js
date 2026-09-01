const fs = require('fs');
const path = require('path');
const { parseLocaleNumber } = require('../server/services/syncService');

const rawRows = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sheets_raw.json'), 'utf8'));
let frumusaDict = [];
try {
  frumusaDict = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'frumusa_tienda_dictionary.json'), 'utf8'));
} catch (e) {}

const dictMap = new Map();
frumusaDict.forEach(d => {
  if (d.codeCountry) dictMap.set(d.codeCountry.trim(), d.codeFrumusa);
});

function getComprehensiveCategory(desc) {
  const d = (desc || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Insumos y Empaques
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

  // 5. Hortalizas y Hojas
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

function parseDateKey(dateStr) {
  if (!dateStr) return 'UNKNOWN';
  const parts = dateStr.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}`;
    } else {
      const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${yr}-${parts[1].padStart(2, '0')}`;
    }
  }
  return dateStr;
}

function formatCRC(num) {
  return '₡' + Math.round(num || 0).toLocaleString('es-CR');
}

function formatQty(num) {
  return Math.round((num || 0) * 10) / 10 >= 1000 ? Math.round(num || 0).toLocaleString('es-CR') : (Math.round((num || 0) * 10) / 10).toString();
}

function formatPercent(pct) {
  return ((pct || 0) * 100).toFixed(1) + '%';
}

function generateReport() {
  console.log('Generando reporte consolidado...');

  const monthsSet = new Set();
  const products = new Map();
  const categorySummary = {};

  rawRows.forEach(row => {
    const monthKey = parseDateKey(row.FECHA_PROCESO);
    monthsSet.add(monthKey);

    const sku = (row.NO_ARTI || '').trim();
    const desc = (row.ARTICULO || '').trim();
    const cat = getComprehensiveCategory(desc);
    const codeFrumusa = dictMap.get(sku) || '';

    const qty = parseLocaleNumber(row.CANTIDAD, 0);
    const monto = parseLocaleNumber(row.MONTO_BRUTO, 0);
    const costoUnit = parseLocaleNumber(row.COSTO_UNITARIO, 0);
    const precio = parseLocaleNumber(row.PRECIO, 0);
    const mermaQty = parseLocaleNumber(row.UNIDADES_MERMA, 0);
    const mermaMonto = parseLocaleNumber(row.COSTO_BRUTO_MERMA, 0);
    const saldo = parseLocaleNumber(row.SALDO_ACTUAL, 0);

    if (!products.has(sku)) {
      products.set(sku, {
        sku,
        codeFrumusa,
        description: desc,
        category: cat,
        unit: row.UNIDAD_EQ || 'UD',
        lastPrice: precio,
        lastCost: costoUnit,
        currentStock: 0,
        totalSalesQty: 0,
        totalSalesMonto: 0,
        totalMermaQty: 0,
        totalMermaMonto: 0,
        sales2024Monto: 0,
        sales2024Qty: 0,
        sales2025Monto: 0,
        sales2025Qty: 0,
        sales2026Monto: 0,
        sales2026Qty: 0,
        monthlyData: {} // monthKey -> { qty, monto, mermaQty, mermaMonto, saldo, price, cost }
      });
    }

    const prod = products.get(sku);
    prod.totalSalesQty += qty;
    prod.totalSalesMonto += monto;
    prod.totalMermaQty += mermaQty;
    prod.totalMermaMonto += mermaMonto;

    if (monthKey.startsWith('2024')) {
      prod.sales2024Monto += monto;
      prod.sales2024Qty += qty;
    } else if (monthKey.startsWith('2025')) {
      prod.sales2025Monto += monto;
      prod.sales2025Qty += qty;
    } else if (monthKey.startsWith('2026')) {
      prod.sales2026Monto += monto;
      prod.sales2026Qty += qty;
    }

    if (precio > 0) prod.lastPrice = precio;
    if (costoUnit > 0) prod.lastCost = costoUnit;
    if (monthKey === '2026-08' || monthKey === '2026-07') {
      prod.currentStock = Math.max(prod.currentStock, saldo);
    }

    if (!prod.monthlyData[monthKey]) {
      prod.monthlyData[monthKey] = { qty: 0, monto: 0, mermaQty: 0, mermaMonto: 0, saldo: 0, price: precio, cost: costoUnit };
    }
    const m = prod.monthlyData[monthKey];
    m.qty += qty;
    m.monto += monto;
    m.mermaQty += mermaQty;
    m.mermaMonto += mermaMonto;
    m.saldo = Math.max(m.saldo, saldo);
    if (precio > 0) m.price = precio;
    if (costoUnit > 0) m.cost = costoUnit;
  });

  const sortedMonths = Array.from(monthsSet).sort();
  const allProducts = Array.from(products.values());

  // Ordenar productos por ventas totales descendente para calcular ABC
  allProducts.sort((a, b) => b.totalSalesMonto - a.totalSalesMonto);

  const grandTotalSales = allProducts.reduce((acc, p) => acc + p.totalSalesMonto, 0);
  const grandTotalMerma = allProducts.reduce((acc, p) => acc + p.totalMermaMonto, 0);
  const grandTotalQty = allProducts.reduce((acc, p) => acc + p.totalSalesQty, 0);
  const grandTotalMermaQty = allProducts.reduce((acc, p) => acc + p.totalMermaQty, 0);

  let cumulativeSales = 0;
  allProducts.forEach(p => {
    cumulativeSales += p.totalSalesMonto;
    const cumPct = cumulativeSales / grandTotalSales;
    if (cumPct <= 0.80) {
      p.abc = 'A';
    } else if (cumPct <= 0.95) {
      p.abc = 'B';
    } else {
      p.abc = 'C';
    }
  });

  // Agrupar por categorías
  const categoriesMap = new Map();
  allProducts.forEach(p => {
    if (!categoriesMap.has(p.category)) {
      categoriesMap.set(p.category, {
        name: p.category,
        products: [],
        totalMonto: 0,
        totalQty: 0,
        totalMermaMonto: 0,
        totalMermaQty: 0,
        sales2024: 0,
        sales2025: 0,
        sales2026: 0,
        monthlyMonto: {},
        monthlyQty: {},
        monthlyMerma: {}
      });
    }
    const cat = categoriesMap.get(p.category);
    cat.products.push(p);
    cat.totalMonto += p.totalSalesMonto;
    cat.totalQty += p.totalSalesQty;
    cat.totalMermaMonto += p.totalMermaMonto;
    cat.totalMermaQty += p.totalMermaQty;
    cat.sales2024 += p.sales2024Monto;
    cat.sales2025 += p.sales2025Monto;
    cat.sales2026 += p.sales2026Monto;

    sortedMonths.forEach(m => {
      if (!cat.monthlyMonto[m]) cat.monthlyMonto[m] = 0;
      if (!cat.monthlyQty[m]) cat.monthlyQty[m] = 0;
      if (!cat.monthlyMerma[m]) cat.monthlyMerma[m] = 0;

      if (p.monthlyData[m]) {
        cat.monthlyMonto[m] += p.monthlyData[m].monto;
        cat.monthlyQty[m] += p.monthlyData[m].qty;
        cat.monthlyMerma[m] += p.monthlyData[m].mermaMonto;
      }
    });
  });

  // Ordenar categorías por monto total de ventas
  const sortedCategories = Array.from(categoriesMap.values()).sort((a, b) => b.totalMonto - a.totalMonto);

  console.log('Grand Totals:', {
    totalSales: formatCRC(grandTotalSales),
    totalMerma: formatCRC(grandTotalMerma),
    mermaPct: formatPercent(grandTotalMerma / grandTotalSales),
    totalSKUs: allProducts.length,
    categoriesCount: sortedCategories.length
  });

  return {
    sortedMonths,
    allProducts,
    sortedCategories,
    grandTotalSales,
    grandTotalMerma,
    grandTotalQty,
    grandTotalMermaQty
  };
}

const reportData = generateReport();
fs.writeFileSync(path.join(__dirname, '..', 'data', 'consolidated_report_data.json'), JSON.stringify(reportData, null, 2), 'utf8');
console.log('✅ Datos consolidados guardados en data/consolidated_report_data.json');
