const https = require('https');
const http = require('http');
const config = require('../config');
const db = require('../db/pool');

/**
 * Función auxiliar para parsear números que pueden venir con coma o punto decimal
 */
function parseLocaleNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return isNaN(value) ? fallback : value;
  
  let str = value.toString().trim();
  // Quitar comillas
  str = str.replace(/^["']|["']$/g, '');
  
  // Si contiene coma como decimal (ej: "525,64" o "1385,40")
  if (str.includes(',') && !str.includes('.')) {
    str = str.replace(',', '.');
  } else if (str.includes(',') && str.includes('.')) {
    // Si tiene comas de miles y punto decimal: "1,234.56"
    str = str.replace(/,/g, '');
  }
  
  const num = parseFloat(str);
  return isNaN(num) ? fallback : num;
}

/**
 * Parser robusto para CSV con comillas y saltos de línea
 */
function parseCSV(csvText) {
  const lines = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // saltar la comilla escapada
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) return [];

  const headers = lines[0].map(h => h.replace(/^["']|["']$/g, '').trim());
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const obj = {};
    headers.forEach((header, index) => {
      let val = row[index] !== undefined ? row[index] : '';
      val = val.replace(/^["']|["']$/g, '').trim();
      obj[header] = val;
    });
    results.push(obj);
  }

  return results;
}

/**
 * Descarga el contenido desde el endpoint de Google Apps Script con soporte para redirecciones 302
 */
function fetchRemoteData(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (res) => {
      // Manejo de redirección 302 de Google Apps Script
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchRemoteData(res.headers.location));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Error HTTP ${res.statusCode}: ${res.statusMessage}`));
      }

      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', err => reject(err));
  });
}

/**
 * Ejecuta el pipeline de sincronización e ingestión desde Google Sheets / ERP Codisa
 */
function getProduceCategory(desc) {
  const d = (desc || '').toUpperCase();
  if (d.includes('CULANTRO') || d.includes('OREGANO') || d.includes('ORÉGANO') || 
      d.includes('PEREJIL') || d.includes('ROMERO') || d.includes('TOMILLO') || 
      d.includes('ALBAHACA') || d.includes('HIERBABUENA') || d.includes('MENTA') || 
      d.includes('LAUREL') || d.includes('ESTRAGON') || d.includes('ESTRAGÓN') || 
      d.includes('ENELDO') || d.includes('CEBOLLIN') || d.includes('CEBOLLINO') || 
      d.includes('AJO') || d.includes('ENCHILADO') || d.includes('ZACATE') || d.includes('COYOL')) {
    return 'Hierbas y Aromáticas';
  }
  if (d.includes('LECHUGA') || d.includes('REPOLLO') || d.includes('ESPINACA') || 
      d.includes('ACELGA') || d.includes('APIO') || d.includes('BROCOLI') || 
      d.includes('BRÓCOLI') || d.includes('COLIFLOR') || d.includes('BERRO') || 
      d.includes('KALE') || d.includes('RUCULA') || d.includes('RÚCULA') || 
      d.includes('REPOLLITAS') || d.includes('MOSTAZA') || d.includes('COLES')) {
    return 'Hortalizas y Hojas';
  }
  if (d.includes('PAPA') || d.includes('ZANAHORIA') || d.includes('CEBOLLA') || 
      d.includes('YUCA') || d.includes('CAMOTE') || d.includes('REMOLACHA') || 
      d.includes('RABANO') || d.includes('RÁBANO') || d.includes('ÑAMPI') || 
      d.includes('TIKISQUE') || d.includes('MALANGA') || d.includes('JENGIBRE') || 
      d.includes('CURCUMA') || d.includes('CÚRCUMA') || d.includes('ARRACACHE') || 
      d.includes('NAME') || d.includes('ÑAME') || d.includes('PICHICHI')) {
    return 'Tubérculos y Raíces';
  }
  if (d.includes('TOMATE') || d.includes('CHILE') || d.includes('CHAYOTE') || 
      d.includes('PEPINO') || d.includes('ZUCCHINI') || d.includes('CALABAZA') || 
      d.includes('BERENJENA') || d.includes('AYOTE') || d.includes('VAINA') || 
      d.includes('VAINICA') || d.includes('MAIZ') || d.includes('MAÍZ') || 
      d.includes('ELOTE') || d.includes('PIPINIAN') || d.includes('PIPIAN')) {
    return 'Vegetales de Fruto';
  }
  if (d.includes('PLATANO') || d.includes('PLÁTANO') || d.includes('BANANO') || 
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
      d.includes('PITAHAYA') || d.includes('GUAYABA')) {
    return 'Frutas Frescas';
  }
  return 'Otros Perecederos';
}

async function syncFromGoogleAppsScript(customUrl) {
  const targetUrl = customUrl || config.GOOGLE_APPS_SCRIPT_URL;
  const startTime = Date.now();
  
  try {
    const rawCsv = await fetchRemoteData(targetUrl);
    const parsedRows = parseCSV(rawCsv);

    if (!parsedRows || parsedRows.length === 0) {
      throw new Error('El archivo CSV descargado no contiene registros válidos.');
    }

    // Función para parsear fecha de proceso y asegurar el registro del MES ACTUAL más reciente
    function parseDateTimestamp(dateStr) {
      if (!dateStr) return 0;
      const parts = dateStr.toString().trim().split(/[/.-]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getTime();
        } else {
          // DD/MM/YYYY
          const yr = parseInt(parts[2], 10) < 100 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
          return new Date(yr, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)).getTime();
        }
      }
      const t = Date.parse(dateStr);
      return isNaN(t) ? 0 : t;
    }

    // Mapear filas crudas de Codisa agrupando por SKU y conservando histórico de cortes
    const codisaMap = new Map();
    const codisaByDesc = new Map();
    const historyMap = new Map();

    parsedRows.forEach(row => {
      const sku = (row.NO_ARTI || '').toString().trim().toUpperCase();
      const articulo = (row.ARTICULO || '').toString().trim().toUpperCase();
      const rowTimestamp = parseDateTimestamp(row.FECHA_PROCESO);

      const record = {
        noArti: sku,
        articulo: row.ARTICULO || '',
        unidadEq: row.UNIDAD_EQ || 'UD',
        cantidadVentas: parseLocaleNumber(row.CANTIDAD, 0),
        precio: parseLocaleNumber(row.PRECIO, 0),
        montoBruto: parseLocaleNumber(row.MONTO_BRUTO, 0),
        costoUnitario: parseLocaleNumber(row.COSTO_UNITARIO, 0),
        saldoActual: parseLocaleNumber(row.SALDO_ACTUAL, 0),
        costoUniMerma: parseLocaleNumber(row.COSTO_UNI_MERMA, 0),
        costoBrutoMerma: parseLocaleNumber(row.COSTO_BRUTO_MERMA, 0),
        unidadesMerma: parseLocaleNumber(row.UNIDADES_MERMA, 0),
        transito: parseLocaleNumber(row.transito, 0),
        bodega: (row.BODEGA || '').toString().trim().toUpperCase(),
        fechaProceso: row.FECHA_PROCESO || new Date().toISOString(),
        timestamp: rowTimestamp
      };

      if (sku) {
        if (!historyMap.has(sku)) historyMap.set(sku, []);
        historyMap.get(sku).push(record);

        const existing = codisaMap.get(sku);
        if (!existing || rowTimestamp > existing.timestamp) {
          codisaMap.set(sku, { ...record });
        } else if (rowTimestamp === existing.timestamp) {
          // Mismo corte de fecha de proceso:
          // 1. VENTAS: Unificar siempre las ventas de ambas bodegas (Tienda 401 + Ruta 400)
          existing.cantidadVentas += record.cantidadVentas;
          existing.montoBruto += record.montoBruto;

          // 2. SALDO: Tomar únicamente el saldo físico real de Tienda (Bodega 401), nunca sobreescribir con 0 de la ruta
          existing.saldoActual = Math.max(existing.saldoActual, record.saldoActual);

          if (record.costoUnitario > 0) existing.costoUnitario = record.costoUnitario;
          if (record.precio > 0) existing.precio = record.precio;
          if (record.transito > 0) existing.transito = Math.max(existing.transito, record.transito);
          if (record.unidadesMerma > 0) existing.unidadesMerma += record.unidadesMerma;
          if (record.costoBrutoMerma > 0) existing.costoBrutoMerma += record.costoBrutoMerma;
        }
      }

      if (articulo) {
        const existingDesc = codisaByDesc.get(articulo);
        if (!existingDesc || rowTimestamp > existingDesc.timestamp) {
          codisaByDesc.set(articulo, { ...record });
        } else if (rowTimestamp === existingDesc.timestamp) {
          // 1. VENTAS: Unificar ventas de ambas bodegas
          existingDesc.cantidadVentas += record.cantidadVentas;
          existingDesc.montoBruto += record.montoBruto;

          // 2. SALDO: Tomar únicamente el saldo físico real de Tienda (Bodega 401)
          existingDesc.saldoActual = Math.max(existingDesc.saldoActual, record.saldoActual);

          if (record.costoUnitario > 0) existingDesc.costoUnitario = record.costoUnitario;
          if (record.precio > 0) existingDesc.precio = record.precio;
          if (record.transito > 0) existingDesc.transito = Math.max(existingDesc.transito, record.transito);
        }
      }
    });

    // Determinar días transcurridos en el mes actual del último corte
    let maxTimestamp = 0;
    codisaMap.forEach(r => { if (r.timestamp > maxTimestamp) maxTimestamp = r.timestamp; });
    const latestDate = new Date(maxTimestamp || Date.now());
    const daysInCurrentMonthCut = latestDate.getDate() > 0 ? latestDate.getDate() : 19;

    // Actualizar catálogo en memoria
    let updatedCount = 0;
    const memoryProducts = db.memoryStore.products;

    if (memoryProducts && memoryProducts.length > 0) {
      memoryProducts.forEach(prod => {
        const key1 = (prod.code_frumusa || prod.codeFrumusa || prod.NO_ARTI || '').toString().trim().toUpperCase();
        const key2 = (prod.code_country || prod.codeCountry || '').toString().trim().toUpperCase();
        const desc = (prod.description || prod.descripcion || prod.ARTICULO || '').toString().trim().toUpperCase();

        const candidates = [];
        if (key1 && codisaMap.has(key1)) candidates.push(codisaMap.get(key1));
        if (key2 && codisaMap.has(key2) && key2 !== key1) candidates.push(codisaMap.get(key2));
        if (desc && codisaByDesc.has(desc)) candidates.push(codisaByDesc.get(desc));

        if (candidates.length === 0 && desc) {
          for (const [d, r] of codisaByDesc.entries()) {
            if (desc.includes(d) || d.includes(desc) || (desc.split(' ')[0] === d.split(' ')[0] && desc.length > 3)) {
              candidates.push(r);
              break;
            }
          }
        }

        let match = null;
        if (candidates.length > 0) {
          // Priorizar: 1) fecha de corte más reciente, 2) existencia física positiva, 3) mayor volumen de ventas
          candidates.sort((a, b) => {
            if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
            if ((b.saldoActual > 0) !== (a.saldoActual > 0)) return b.saldoActual > 0 ? 1 : -1;
            return (b.cantidadVentas || 0) - (a.cantidadVentas || 0);
          });
          match = candidates[0];
        }

        if (match) {
          prod.stock_actual = match.saldoActual;
          prod.stock = match.saldoActual;
          prod.SALDO_ACTUAL = match.saldoActual;
          
          prod.sales_period = match.cantidadVentas;
          prod.ventas = match.cantidadVentas;
          prod.CANTIDAD = match.cantidadVentas;
          prod.days_in_month_cut = daysInCurrentMonthCut;

          // Calcular ventas acumuladas de los últimos 60 días si hay histórico disponible
          const history = historyMap.get(match.noArti) || [];
          if (history.length > 0) {
            const sixtyDaysAgo = maxTimestamp - (60 * 24 * 60 * 60 * 1000);
            const recentHistory = history.filter(h => h.timestamp >= sixtyDaysAgo);
            const sum60d = recentHistory.reduce((acc, h) => acc + h.cantidadVentas, 0);
            if (sum60d > 0) {
              prod.sales_60d = sum60d;
            }
          }
          
          if (match.costoUnitario > 0) {
            prod.unit_cost = match.costoUnitario;
            prod.cost = match.costoUnitario;
            prod.COSTO_UNITARIO = match.costoUnitario;
          }
          
          if (match.precio > 0) {
            prod.unit_price = match.precio;
            prod.PRECIO = match.precio;
          }

          prod.merma_units = match.unidadesMerma;
          prod.merma_cost = match.costoBrutoMerma;
          if (!prod.category || prod.category === 'Perecederos' || prod.category === 'General') {
            prod.category = getProduceCategory(prod.description || match.articulo || '');
          }
          updatedCount++;
        }
      });
    }

    const logEntry = {
      id: Date.now(),
      source: 'Google Apps Script / Codisa Raw Feed',
      status: 'SUCCESS',
      rowsProcessed: parsedRows.length,
      matchedSkus: updatedCount,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      details: `Sincronización exitosa. Se procesaron ${parsedRows.length} registros y se actualizaron ${updatedCount} SKUs del catálogo.`
    };

    db.memoryStore.syncLogs.unshift(logEntry);
    if (db.memoryStore.syncLogs.length > 50) {
      db.memoryStore.syncLogs.pop();
    }

    return {
      success: true,
      log: logEntry,
      dataSample: parsedRows.slice(0, 5)
    };
  } catch (error) {
    const errorLog = {
      id: Date.now(),
      source: 'Google Apps Script / Codisa Raw Feed',
      status: 'ERROR',
      rowsProcessed: 0,
      matchedSkus: 0,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      details: `Error de sincronización: ${error.message}`
    };
    db.memoryStore.syncLogs.unshift(errorLog);
    return {
      success: false,
      error: error.message,
      log: errorLog
    };
  }
}

module.exports = {
  syncFromGoogleAppsScript,
  parseCSV,
  parseLocaleNumber
};
