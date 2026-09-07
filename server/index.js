const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const db = require('./db/pool');
const kvStore = require('./db/keyValueStore');

const authRoutes = require('./routes/auth');
const planningRoutes = require('./routes/planning');
const productsRoutes = require('./routes/products');
const syncRoutes = require('./routes/sync');
const analyticsRoutes = require('./routes/analytics');
const syncService = require('./services/syncService');

const app = express();

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

// Load Initial Data from data.js or synced_catalog.json into Memory Store
async function initApp() {
  await kvStore.initDb();
  try {
    const syncedCatalogPath = path.join(__dirname, '..', 'data', 'synced_catalog.json');
    if (fs.existsSync(syncedCatalogPath)) {
      try {
        const synced = JSON.parse(fs.readFileSync(syncedCatalogPath, 'utf8'));
        if (Array.isArray(synced) && synced.length > 0) {
          synced.forEach(item => {
            item.transit_qty = 0;
            item.transit = 0;
          });
          db.initMemoryStore(synced);
          console.log(`✅ [Master MRP]: Catálogo oficial cargado desde synced_catalog.json con ${synced.length} SKUs.`);

          // 1. Reconcile persistent catalog overrides (from PostgreSQL DB or disk) onto memory store
          try {
            const overridesFilePath = path.join(__dirname, '..', 'data', 'catalog_overrides.json');
            const dbOverrides = await kvStore.get('catalog_overrides');
            let overrides = dbOverrides;
            if (!overrides && fs.existsSync(overridesFilePath)) {
              overrides = JSON.parse(fs.readFileSync(overridesFilePath, 'utf8')) || {};
            }
            if (overrides && typeof overrides === 'object' && Object.keys(overrides).length > 0) {
              let appliedCount = 0;
              db.memoryStore.products.forEach(item => {
                const skuKey = ((item.code_frumusa && item.code_frumusa.trim()) ? item.code_frumusa.trim() : (item.code_country ? item.code_country.trim() : (item.codeSku || ''))).toUpperCase();
                const k1 = (item.code_frumusa || item.codeFrumusa || '').toString().trim().toUpperCase();
                const k2 = (item.code_country || item.codeCountry || '').toString().trim().toUpperCase();
                const k3 = (item.codeSku || '').toString().trim().toUpperCase();
                
                const ov = overrides[skuKey] || (k1 ? overrides[k1] : null) || (k3 ? overrides[k3] : null) || overrides[k2];
                if (ov) {
                  if (ov.is_active !== undefined) {
                    item.is_active = Boolean(ov.is_active);
                    item.isActive = Boolean(ov.is_active);
                  }
                  if (ov.pack_multiple !== undefined) {
                    item.pack_multiple = Number(ov.pack_multiple);
                    item.packMultiple = Number(ov.pack_multiple);
                  }
                  if (ov.min_coverage_qty !== undefined) {
                    item.min_coverage_qty = Number(ov.min_coverage_qty);
                    item.minCoverageUnits = Number(ov.min_coverage_qty);
                    item.safety_stock_units = Number(ov.min_coverage_qty);
                  }
                  appliedCount++;
                }
              });
              console.log(`🎯 [Master MRP]: ${appliedCount} productos inicializados con parámetros y estados personalizados.`);
            }
          } catch (e) {
            console.warn('⚠️ Error al aplicar overrides iniciales al catálogo:', e.message);
          }

          // 2. Reconcile active in-transit orders (from PostgreSQL DB or local disk)
          const ordersFilePath = path.join(__dirname, '..', 'data', 'active_orders.json');
          try {
            const dbOrders = await kvStore.get('active_orders');
            let savedOrders = Array.isArray(dbOrders) && dbOrders.length > 0 ? dbOrders : null;
            if (!savedOrders && fs.existsSync(ordersFilePath)) {
              savedOrders = JSON.parse(fs.readFileSync(ordersFilePath, 'utf8'));
            }
            if (Array.isArray(savedOrders) && savedOrders.length > 0) {
              db.memoryStore.orders = savedOrders;
              console.log(`📦 [Orders Store]: ${savedOrders.length} órdenes cargadas desde almacenamiento.`);

              // Reconcile active in-transit stock onto catalog products
              savedOrders.forEach(ord => {
                if (ord.status === 'EN_TRANSITO' && Array.isArray(ord.items)) {
                  ord.items.forEach(it => {
                    const prod = db.memoryStore.products.find(p => (
                      (p.code_frumusa && p.code_frumusa.toString() === it.codeSku) ||
                      (p.codeFrumusa && p.codeFrumusa.toString() === it.codeSku) ||
                      (p.code_country && p.code_country.toString() === it.codeSku) ||
                      (p.codeCountry && p.codeCountry.toString() === it.codeSku) ||
                      (p.codeSku && p.codeSku.toString() === it.codeSku) ||
                      (p.NO_ARTI && p.NO_ARTI.toString() === it.codeSku)
                    ));
                    if (prod) {
                      prod.transit_qty = (Number(prod.transit_qty || 0)) + (Number(it.finalQty || it.quantity || 0));
                      prod.transit = prod.transit_qty;
                    }
                  });
                }
              });
            }
          } catch (e) {
            console.warn('⚠️ Error al cargar órdenes persistidas:', e.message);
          }
          return;
        }
      } catch(e) {
        console.warn('⚠️ Error al leer synced_catalog.json, usando fallback data.js:', e.message);
      }
    }

    const dataJsPath = path.join(__dirname, '..', 'data.js');
    if (fs.existsSync(dataJsPath)) {
      const dataCode = fs.readFileSync(dataJsPath, 'utf8');
      const loadFn = new Function(dataCode + '; return { INITIAL_CONFIG, INITIAL_PEDIDOS, INITIAL_DATA, INITIAL_HOJA1 };');
      const loaded = loadFn();

      const dataByNoArti = new Map();
      const dataByDesc = new Map();
      if (Array.isArray(loaded.INITIAL_DATA)) {
        loaded.INITIAL_DATA.forEach(row => {
          if (row.NO_ARTI !== undefined && row.NO_ARTI !== null) {
            dataByNoArti.set(row.NO_ARTI.toString().trim().toUpperCase(), row);
          }
          if (row.ARTICULO) {
            dataByDesc.set(row.ARTICULO.toString().trim().toUpperCase(), row);
          }
        });
      }

      if (Array.isArray(loaded.INITIAL_PEDIDOS)) {
        const merged = loaded.INITIAL_PEDIDOS
          .filter(row => row && ((row['Codigo frumusa'] !== undefined && row['Codigo frumusa'] !== '') || (row['Código country'] !== undefined && row['Código country'] !== '') || row['Descripción']))
          .map(row => {
          const codeFrumusa = (row['Codigo frumusa'] !== undefined ? row['Codigo frumusa'] : '').toString().trim();
          const codeCountry = (row['Código country'] !== undefined ? row['Código country'] : '').toString().trim();
          const desc = (row['Descripción'] || '').toString().trim().toUpperCase();

          let dataMatch = (codeFrumusa ? dataByNoArti.get(codeFrumusa.toUpperCase()) : null) ||
                          (codeCountry ? dataByNoArti.get(codeCountry.toUpperCase()) : null) ||
                          (desc ? dataByDesc.get(desc) : null);

          if (!dataMatch && desc) {
            for (const [d, r] of dataByDesc.entries()) {
              if (desc.includes(d) || d.includes(desc) || (desc.split(' ')[0] === d.split(' ')[0] && desc.length > 3)) {
                dataMatch = r;
                break;
              }
            }
          }

          let stock = Number(row['Stock'] || 0);
          if (dataMatch && dataMatch['SALDO_ACTUAL'] !== undefined) {
            stock = Number(dataMatch['SALDO_ACTUAL']);
          }

          let sales = Number(row['Ventas del período'] || 0);
          if (dataMatch && dataMatch['CANTIDAD'] !== undefined) {
            sales = Number(dataMatch['CANTIDAD']);
          }

          let cost = 0;
          if (dataMatch && Number(dataMatch['COSTO_UNITARIO']) > 0) {
            cost = Number(dataMatch['COSTO_UNITARIO']);
          } else if (Number(row['Costo unitario'] || row['Costo'] || 0) > 0) {
            cost = Number(row['Costo unitario'] || row['Costo']);
          } else {
            const origFinal = Number(row['Pedido sugerido'] || row['PEDIDO FINAL'] || 0);
            const origCost = Number(row['Costo de pedido'] || 0);
            if (origFinal > 0 && origCost > 0) cost = origCost / origFinal;
          }

          let price = 0;
          if (dataMatch && Number(dataMatch['PRECIO']) > 0) {
            price = Number(dataMatch['PRECIO']);
          } else if (cost > 0) {
            price = cost * 1.35;
          }

          const transit = 0;
          const packMultiple = Number(row['Múltiplo de pedido'] || 1);
          const minCoverage = Number(row['Cobertura minima'] || row['Covertura meta'] || (packMultiple * 2));
          const prodDesc = row['Descripción'] || (dataMatch ? dataMatch['ARTICULO'] : 'Producto sin descripción');
          const category = row['Categoría'] || (dataMatch ? dataMatch['CATEGORIA'] : null) || getProduceCategory(prodDesc);

          return {
            code_country: codeCountry,
            code_frumusa: codeFrumusa,
            description: prodDesc,
            stock_actual: stock,
            sales_period: sales,
            days_period: Number(config.DEFAULT_VDP_DAYS || 60),
            unit_cost: cost,
            unit_price: price,
            transit_qty: 0,
            transit: 0,
            pack_multiple: packMultiple > 0 ? packMultiple : 1,
            min_coverage_qty: minCoverage > 0 ? minCoverage : packMultiple,
            safety_stock_units: minCoverage > 0 ? minCoverage : packMultiple,
            merma_units: dataMatch ? Number(dataMatch['UNIDADES_MERMA'] || 0) : 0,
            merma_cost: dataMatch ? Number(dataMatch['COSTO_BRUTO_MERMA'] || 0) : 0,
            category: category
          };
        });

        db.initMemoryStore(merged);
        console.log(`✅ [Master MRP]: Catálogo inicial cargado con ${merged.length} SKUs.`);

        // 1. Load Orders from DB first
        let ordersLoaded = false;
        const dbOrders = await kvStore.get('active_orders');
        if (dbOrders && Array.isArray(dbOrders)) {
          db.memoryStore.orders = dbOrders;
          ordersLoaded = true;
          console.log(`📦 [Orders Store]: ${dbOrders.length} órdenes cargadas desde DB.`);
        }

        if (!ordersLoaded) {
          const ordersFilePath = path.join(__dirname, '..', 'data', 'active_orders.json');
          if (fs.existsSync(ordersFilePath)) {
            try {
              const savedOrders = JSON.parse(fs.readFileSync(ordersFilePath, 'utf8'));
              if (Array.isArray(savedOrders) && savedOrders.length > 0) {
                db.memoryStore.orders = savedOrders;
                console.log(`📦 [Orders Store]: ${savedOrders.length} órdenes cargadas desde FS.`);
              }
            } catch (e) {
              console.warn('⚠️ Error al cargar órdenes persistidas:', e.message);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ [Bootstrap Warning]:', err.message);
  }

  // Reload Overrides from DB or FS
  if (productsRoutes.reloadOverrides) {
    await productsRoutes.reloadOverrides();
  }
  
  if (productsRoutes.applyOverridesToProducts && Array.isArray(db.memoryStore.products)) {
    productsRoutes.applyOverridesToProducts(db.memoryStore.products);
  }

  // Auto-sync with live Google Sheets feed on boot
  syncService.syncFromGoogleAppsScript()
    .then(res => {
      if (productsRoutes.applyOverridesToProducts && Array.isArray(db.memoryStore.products)) {
        productsRoutes.applyOverridesToProducts(db.memoryStore.products);
      }
      console.log(`🔄 [Live Sync Boot]: Sincronización inicial completada (${res.log.matchedSkus} SKUs actualizados con overrides preservados).`);
    })
    .catch(e => console.warn('⚠️ [Live Sync Boot Warning]:', e.message));
}

initApp();

// Security Middlewares (Helmet with relaxed CSP for CDN dependencies)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          'https://cdn.jsdelivr.net',
          'https://cdnjs.cloudflare.com'
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://cdnjs.cloudflare.com'
        ],
        fontSrc: [
          "'self'",
          'https://fonts.gstatic.com',
          'https://cdnjs.cloudflare.com'
        ],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'https:', 'http:']
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// CORS
app.use(cors({ origin: config.CORS_ORIGIN }));

// JSON & Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiters
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Por favor reintenta en unos minutos.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Demasiados intentos de autenticación.' }
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/planning', planningRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    dbConnected: db.isDbConnected(),
    totalProducts: db.memoryStore.products.length,
    totalOrders: db.memoryStore.orders.length
  });
});

// Serve Static Frontend files
app.use(express.static(path.join(__dirname, '..')));

// Catch-all route to serve index.html for SPA navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Start Server if executed directly
if (require.main === module) {
  app.listen(config.PORT, () => {
    console.log(`🚀 [Master Planning MRP Server] escuchando en http://localhost:${config.PORT}`);
    console.log(`📊 Entorno: ${config.NODE_ENV} | Moneda: ${config.CURRENCY} (${config.CURRENCY_SYMBOL})`);
  });
}

module.exports = app;
