const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db/pool');

const syncedCatalogPath = path.join(__dirname, '..', '..', 'data', 'synced_catalog.json');

function persistCatalogToDisk() {
  try {
    if (Array.isArray(db.memoryStore.products)) {
      fs.writeFileSync(syncedCatalogPath, JSON.stringify(db.memoryStore.products, null, 2), 'utf8');
    }
  } catch (e) {
    console.warn('⚠️ Error al persistir catálogo en disco:', e.message);
  }
}

// GET /api/products - Get all catalog products
router.get('/', (req, res) => {
  try {
    const products = db.memoryStore.products || [];
    const search = (req.query.search || '').toLowerCase();
    const category = req.query.category;

    let filtered = products;

    if (search) {
      filtered = filtered.filter(p => {
        const desc = (p.description || p.descripcion || p.ARTICULO || '').toLowerCase();
        const fCode = (p.code_frumusa || p.codeFrumusa || p.NO_ARTI || '').toString().toLowerCase();
        const cCode = (p.code_country || p.codeCountry || '').toString().toLowerCase();
        return desc.includes(search) || fCode.includes(search) || cCode.includes(search);
      });
    }

    if (category && category !== 'all') {
      filtered = filtered.filter(p => (p.category || p.categoria || 'General').toLowerCase() === category.toLowerCase());
    }

    res.json({
      total: products.length,
      filteredCount: filtered.length,
      products: filtered
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos.' });
  }
});

// POST /api/products/batch-update - Batch update catalog parameters and persist on server
router.post('/batch-update', (req, res) => {
  try {
    const { overrides } = req.body || {};
    if (!overrides || typeof overrides !== 'object') {
      return res.status(400).json({ error: 'Formato de overrides inválido.' });
    }

    const products = db.memoryStore.products || [];
    let updatedCount = 0;

    products.forEach(item => {
      const k1 = (item.code_frumusa || item.codeFrumusa || '').toString().trim().toUpperCase();
      const k2 = (item.code_country || item.codeCountry || '').toString().trim().toUpperCase();
      const k3 = (item.codeSku || '').toString().trim().toUpperCase();
      const ov = overrides[k1] || overrides[k2] || overrides[k3];

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
        if (ov.code_frumusa !== undefined) {
          item.code_frumusa = ov.code_frumusa;
          item.codeFrumusa = ov.code_frumusa;
        }
        if (ov.code_country !== undefined) {
          item.code_country = ov.code_country;
          item.codeCountry = ov.code_country;
        }
        if (ov.unit_eq) item.unit_eq = ov.unit_eq;
        if (ov.description) item.description = ov.description;
        updatedCount++;
      }
    });

    persistCatalogToDisk();

    res.json({
      success: true,
      message: `${updatedCount} productos actualizados y guardados permanentemente en el servidor.`,
      updatedCount
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar cambios masivos en el servidor.' });
  }
});

// GET /api/products/:sku - Get specific SKU detail
router.get('/:sku', (req, res) => {
  const sku = req.params.sku.toString().trim().toUpperCase();
  const product = (db.memoryStore.products || []).find(p => (
    (p.code_frumusa && p.code_frumusa.toString().toUpperCase() === sku) ||
    (p.codeFrumusa && p.codeFrumusa.toString().toUpperCase() === sku) ||
    (p.NO_ARTI && p.NO_ARTI.toString().toUpperCase() === sku) ||
    (p.code_country && p.code_country.toString().toUpperCase() === sku) ||
    (p.codeCountry && p.codeCountry.toString().toUpperCase() === sku)
  ));

  if (!product) {
    return res.status(404).json({ error: `Producto ${sku} no encontrado.` });
  }

  res.json({ product });
});

// POST /api/products/:sku/toggle-active - Toggle active status for SKU on server
router.post('/:sku/toggle-active', (req, res) => {
  const sku = req.params.sku.toString().trim().toUpperCase();
  const product = (db.memoryStore.products || []).find(p => (
    (p.code_frumusa && p.code_frumusa.toString().toUpperCase() === sku) ||
    (p.codeFrumusa && p.codeFrumusa.toString().toUpperCase() === sku) ||
    (p.NO_ARTI && p.NO_ARTI.toString().toUpperCase() === sku) ||
    (p.code_country && p.code_country.toString().toUpperCase() === sku) ||
    (p.codeCountry && p.codeCountry.toString().toUpperCase() === sku)
  ));

  if (!product) {
    return res.status(404).json({ error: `Producto ${sku} no encontrado.` });
  }

  const { isActive } = req.body || {};
  const newStatus = isActive !== undefined ? Boolean(isActive) : !(product.is_active !== false && product.isActive !== false);

  product.is_active = newStatus;
  product.isActive = newStatus;

  persistCatalogToDisk();

  res.json({
    success: true,
    message: `Producto ${sku} marcado como ${newStatus ? 'Activo' : 'Inactivo'} en el servidor.`,
    is_active: newStatus,
    product
  });
});

// PUT /api/products/:sku - Update product parameters and persist on server
router.put('/:sku', (req, res) => {
  const sku = req.params.sku.toString().trim().toUpperCase();
  const product = (db.memoryStore.products || []).find(p => (
    (p.code_frumusa && p.code_frumusa.toString().toUpperCase() === sku) ||
    (p.codeFrumusa && p.codeFrumusa.toString().toUpperCase() === sku) ||
    (p.NO_ARTI && p.NO_ARTI.toString().toUpperCase() === sku) ||
    (p.code_country && p.code_country.toString().toUpperCase() === sku) ||
    (p.codeCountry && p.codeCountry.toString().toUpperCase() === sku)
  ));

  if (!product) {
    return res.status(404).json({ error: `Producto ${sku} no encontrado.` });
  }

  const { stockActual, transitQty, packMultiple, minCoverageQty, safetyStockDays, unitCost, description, codeFrumusa, codeCountry, unitEq, isActive } = req.body;

  if (isActive !== undefined) {
    product.is_active = Boolean(isActive);
    product.isActive = Boolean(isActive);
  }
  if (stockActual !== undefined) {
    product.stock_actual = Number(stockActual);
    product.stock = Number(stockActual);
  }
  if (transitQty !== undefined) {
    product.transit_qty = Number(transitQty);
    product.transit = Number(transitQty);
  }
  if (packMultiple !== undefined) {
    product.pack_multiple = Math.max(1, Number(packMultiple));
    product.packMultiple = product.pack_multiple;
    product.multiplo = product.pack_multiple;
  }
  if (minCoverageQty !== undefined) {
    product.min_coverage_qty = Number(minCoverageQty);
    product.minCoverageUnits = Number(minCoverageQty);
    product.safety_stock_units = Number(minCoverageQty);
  }
  if (safetyStockDays !== undefined) {
    product.safety_stock_days = Number(safetyStockDays);
    product.coberturaMeta = product.safety_stock_days;
  }
  if (unitCost !== undefined) {
    product.unit_cost = Number(unitCost);
    product.cost = Number(unitCost);
  }
  if (description !== undefined) product.description = description;
  if (codeFrumusa !== undefined) {
    product.code_frumusa = codeFrumusa;
    product.codeFrumusa = codeFrumusa;
  }
  if (codeCountry !== undefined) {
    product.code_country = codeCountry;
    product.codeCountry = codeCountry;
  }
  if (unitEq !== undefined) product.unit_eq = unitEq;

  persistCatalogToDisk();

  res.json({
    success: true,
    message: `Producto ${sku} actualizado y guardado permanentemente en el servidor.`,
    product
  });
});

module.exports = router;
