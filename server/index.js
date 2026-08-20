const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const db = require('./db/pool');

const authRoutes = require('./routes/auth');
const planningRoutes = require('./routes/planning');
const productsRoutes = require('./routes/products');
const syncRoutes = require('./routes/sync');
const analyticsRoutes = require('./routes/analytics');

const app = express();

// Load Initial Data from data.js into Memory Store
function bootstrapCatalog() {
  try {
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

          const transit = Number(row['Transito'] || 0);
          const packMultiple = Number(row['Múltiplo de pedido'] || 1);
          const safetyStock = Number(row['Covertura meta'] || 1);

          return {
            code_country: codeCountry,
            code_frumusa: codeFrumusa,
            description: row['Descripción'] || (dataMatch ? dataMatch['ARTICULO'] : 'Producto sin descripción'),
            stock_actual: stock,
            sales_period: sales,
            days_period: Number(config.DEFAULT_VDP_DAYS || 60),
            unit_cost: cost,
            unit_price: price,
            transit_qty: transit,
            pack_multiple: packMultiple > 0 ? packMultiple : 1,
            safety_stock_days: safetyStock > 0 ? safetyStock : 1,
            merma_units: dataMatch ? Number(dataMatch['UNIDADES_MERMA'] || 0) : 0,
            merma_cost: dataMatch ? Number(dataMatch['COSTO_BRUTO_MERMA'] || 0) : 0,
            category: 'Perecederos'
          };
        });

        db.initMemoryStore(merged);
        console.log(`✅ [Master MRP]: Catálogo inicial cargado con ${merged.length} SKUs.`);
      }
    }
  } catch (err) {
    console.warn('⚠️ [Bootstrap Warning]:', err.message);
  }
}

bootstrapCatalog();

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
