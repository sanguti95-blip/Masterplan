const db = require('./pool');

async function initDb() {
  await db.testConnection();
  if (db.pool) {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS mrp_store (
          key VARCHAR(255) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ [DB] Tabla mrp_store verificada/creada en PostgreSQL (Supabase).');
    } catch (err) {
      console.warn('⚠️ [DB] Error creando tabla mrp_store:', err.message);
    }
  }
}

async function get(key) {
  if (db.pool) {
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
  if (db.pool) {
    try {
      const res = await db.query(`
        INSERT INTO mrp_store (key, data, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE
        SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP
      `, [key, JSON.stringify(data)]);
      return Boolean(res && res.rowCount !== undefined);
    } catch (err) {
      console.warn(`⚠️ [DB] Error guardando key ${key}:`, err.message);
    }
  }
  return false;
}

module.exports = { initDb, get, set };
