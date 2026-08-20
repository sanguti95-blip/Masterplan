const express = require('express');
const router = express.Router();
const db = require('../db/pool');
const syncService = require('../services/syncService');
const config = require('../config');

// POST /api/sync/trigger - Ingest raw Codisa data from Google Sheets / Apps Script
router.post('/trigger', async (req, res) => {
  try {
    const customUrl = req.body.url || config.GOOGLE_APPS_SCRIPT_URL;
    const result = await syncService.syncFromGoogleAppsScript(customUrl);

    if (result.success) {
      res.json({
        success: true,
        message: '¡Sincronización con Google Sheets / CODISA completada con éxito!',
        log: result.log,
        sample: result.dataSample
      });
    } else {
      res.status(502).json({
        success: false,
        error: result.error,
        log: result.log
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error durante la ejecución del pipeline de sincronización.' });
  }
});

// GET /api/sync/status - Check sync status
router.get('/status', (req, res) => {
  const logs = db.memoryStore.syncLogs || [];
  const latestLog = logs.length > 0 ? logs[0] : null;

  res.json({
    googleAppsScriptUrl: config.GOOGLE_APPS_SCRIPT_URL,
    totalLogs: logs.length,
    latestSync: latestLog,
    isConfigured: Boolean(config.GOOGLE_APPS_SCRIPT_URL)
  });
});

// GET /api/sync/logs - Get sync history logs
router.get('/logs', (req, res) => {
  res.json({
    logs: db.memoryStore.syncLogs || []
  });
});

module.exports = router;
