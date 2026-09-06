const db = require('./pool');

async function initDb() {
  if (db.isDbConnected()) {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS mrp_store (
          key VARCHAR(255) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ [DB] Tabla mrp_store verificada/creada.');
    } catch (err) {
      console.warn('⚠️ [DB] Error creando tabla mrp_store:', err.message);
    }
  }
}

async function get(key) {
  if (db.isDbConnected()) {
    try {
      const res = await db.query('SELECT data FROM mrp_store WHERE key = $1', [key]);
      if (res && res.rows && res.rows.length > 0) {
        return res.rows[0].data;
      }
    } catch (err) {
      console.warn(`⚠️ [DB] Error leyendo key ${key}:`, err.message);
    }
  }
  return null;
}

async function set(key, data) {
  if (db.isDbConnected()) {
    try {
      await db.query(`
        INSERT INTO mrp_store (key, data, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE
        SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP
      `, [key, JSON.stringify(data)]);
      return true;
    } catch (err) {
      console.warn(`⚠️ [DB] Error guardando key ${key}:`, err.message);
    }
  }
  return false;
}

module.exports = { initDb, get, set };
