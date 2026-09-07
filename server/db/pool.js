const { Pool } = require('pg');
const config = require('../config');

let pool = null;
let isConnected = false;

if (config.DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('connect', () => {
      isConnected = true;
    });

    pool.on('error', (err) => {
      console.warn('⚠️ [PostgreSQL Pool Error]:', err.message);
      isConnected = false;
    });
  } catch (err) {
    console.warn('⚠️ [PostgreSQL Init Warning]:', err.message);
  }
}

// In-Memory Data Store Fallback for high performance & offline operation
const memoryStore = {
  products: [],
  orders: [],
  syncLogs: [],
  settings: {
    safetyStockDays: config.DEFAULT_SAFETY_STOCK_DAYS,
    leadTimeHours: config.DEFAULT_LEAD_TIME_HOURS,
    currency: config.CURRENCY
  }
};

// Initialize in-memory data store from initial catalog if available
function initMemoryStore(initialItems = []) {
  if (initialItems.length > 0) {
    memoryStore.products = JSON.parse(JSON.stringify(initialItems));
  }
}

async function query(text, params = []) {
  if (pool) {
    try {
      const start = Date.now();
      const res = await pool.query(text, params);
      isConnected = true;
      const duration = Date.now() - start;
      return { rows: res.rows, rowCount: res.rowCount, duration };
    } catch (error) {
      console.warn('⚠️ PostgreSQL query failed:', error.message);
      isConnected = false;
    }
  }
  return null;
}

async function testConnection() {
  if (!pool) return false;
  try {
    const res = await query('SELECT 1 as connected');
    if (res && res.rows && res.rows.length > 0) {
      isConnected = true;
      console.log('✅ [PostgreSQL Pool]: Conexión exitosa y verificada con base de datos.');
      return true;
    }
  } catch (e) {
    isConnected = false;
  }
  return false;
}

module.exports = {
  pool,
  query,
  testConnection,
  memoryStore,
  initMemoryStore,
  isDbConnected: () => Boolean(pool && isConnected)
};
