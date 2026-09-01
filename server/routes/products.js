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

const overridesFilePath = path.join(__dirname, '..', '..', 'data', 'catalog_overrides.json');

function loadOverridesFromDisk() {
  try {
    if (fs.existsSync(overridesFilePath)) {
      return JSON.parse(fs.readFileSync(overridesFilePath, 'utf8')) || {};
    }
  } catch (e) {
    console.warn('⚠️ Error al leer catalog_overrides.json:', e.message);
  }
  return {};
}

function persistOverridesToDisk(overrides) {
  try {
    const dataDir = path.dirname(overridesFilePath);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(overridesFilePath, JSON.stringify(overrides || {}, null, 2), 'utf8');
  } catch (e) {
    console.warn('⚠️ Error al persistir catalog_overrides.json:', e.message);
  }
}

// GET /api/products/overrides - Get all persistent catalog overrides
router.get('/overrides', (req, res) => {
  const overrides = loadOverridesFromDisk();
  res.json({ overrides });
});

// POST /api/products/overrides - Save/Merge catalog overrides
router.post('/overrides', (req, res) => {
  try {
    const { overrides } = req.body || {};
    if (!overrides || typeof overrides !== 'object') {
      return res.status(400).json({ error: 'Formato de overrides inválido.' });
    }

    const current = loadOverridesFromDisk();
    const merged = { ...current, ...overrides };
    persistOverridesToDisk(merged);

    // Apply to in-memory products
    const products = db.memoryStore.products || [];
    let appliedCount = 0;
    products.forEach(item => {
      const skuKey = ((item.code_frumusa && item.code_frumusa.trim()) ? item.code_frumusa.trim() : (item.code_country ? item.code_country.trim() : (item.codeSku || ''))).toUpperCase();
      const k1 = (item.code_frumusa || item.codeFrumusa || '').toString().trim().toUpperCase();
      const k2 = (item.code_country || item.codeCountry || '').toString().trim().toUpperCase();
      const k3 = (item.codeSku || '').toString().trim().toUpperCase();
      
      const ov = merged[skuKey] || (k1 ? merged[k1] : null) || (k3 ? merged[k3] : null) || merged[k2];
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
        appliedCount++;
      }
    });

    persistCatalogToDisk();

    res.json({
      success: true,
      message: `Overrides guardados exitosamente. ${appliedCount} productos actualizados.`,
      overrides: merged
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar overrides.' });
  }
});

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

function findProduct(products, sku) {
  if (!sku || !Array.isArray(products)) return null;
  const cleanSku = sku.toString().trim().toUpperCase();
  return products.find(p => {
    const k = ((p.code_frumusa && p.code_frumusa.trim()) ? p.code_frumusa.trim() : (p.code_country ? p.code_country.trim() : (p.codeSku || p.NO_ARTI || ''))).toUpperCase();
    return k === cleanSku;
  }) || products.find(p => (
    (p.code_frumusa && p.code_frumusa.toString().toUpperCase() === cleanSku) ||
    (p.codeFrumusa && p.codeFrumusa.toString().toUpperCase() === cleanSku) ||
    (p.code_country && p.code_country.toString().toUpperCase() === cleanSku) ||
    (p.codeCountry && p.codeCountry.toString().toUpperCase() === cleanSku) ||
    (p.codeSku && p.codeSku.toString().toUpperCase() === cleanSku) ||
    (p.NO_ARTI && p.NO_ARTI.toString().toUpperCase() === cleanSku)
  ));
}

// POST /api/products/batch-update - Batch update catalog parameters and persist on server
router.post('/batch-update', (req, res) => {
  try {
    const { overrides } = req.body || {};
    if (!overrides || typeof overrides !== 'object') {
      return res.status(400).json({ error: 'Formato de overrides inválido.' });
    }

    const current = loadOverridesFromDisk();
    const merged = { ...current, ...overrides };
    persistOverridesToDisk(merged);

    const products = db.memoryStore.products || [];
    let updatedCount = 0;

    products.forEach(item => {
      const skuKey = ((item.code_frumusa && item.code_frumusa.trim()) ? item.code_frumusa.trim() : (item.code_country ? item.code_country.trim() : (item.codeSku || ''))).toUpperCase();
      const k1 = (item.code_frumusa || item.codeFrumusa || '').toString().trim().toUpperCase();
      const k2 = (item.code_country || item.codeCountry || '').toString().trim().toUpperCase();
      const k3 = (item.codeSku || '').toString().trim().toUpperCase();
      
      const ov = merged[skuKey] || (k1 ? merged[k1] : null) || (k3 ? merged[k3] : null) || merged[k2];

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
  const product = findProduct(db.memoryStore.products, req.params.sku);

  if (!product) {
    return res.status(404).json({ error: `Producto ${req.params.sku} no encontrado.` });
  }

  res.json({ product });
});

// POST /api/products/:sku/toggle-active - Toggle active status for SKU on server
router.post('/:sku/toggle-active', (req, res) => {
  const sku = req.params.sku;
  const product = findProduct(db.memoryStore.products, sku);

  if (!product) {
    return res.status(404).json({ error: `Producto ${sku} no encontrado.` });
  }

  const { isActive } = req.body || {};
  const newStatus = isActive !== undefined ? Boolean(isActive) : !(product.is_active !== false && product.isActive !== false);

  product.is_active = newStatus;
  product.isActive = newStatus;

  // Persist to overrides file
  const skuKey = ((product.code_frumusa && product.code_frumusa.trim()) ? product.code_frumusa.trim() : (product.code_country ? product.code_country.trim() : (product.codeSku || sku))).toUpperCase();
  const current = loadOverridesFromDisk();
  current[skuKey] = { ...(current[skuKey] || {}), is_active: newStatus };
  persistOverridesToDisk(current);

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
  const sku = req.params.sku;
  const product = findProduct(db.memoryStore.products, sku);

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

  // Persist to overrides file
  const skuKey = ((product.code_frumusa && product.code_frumusa.trim()) ? product.code_frumusa.trim() : (product.code_country ? product.code_country.trim() : (product.codeSku || sku))).toUpperCase();
  const current = loadOverridesFromDisk();
  current[skuKey] = {
    ...(current[skuKey] || {}),
    is_active: product.is_active,
    pack_multiple: product.pack_multiple,
    min_coverage_qty: product.min_coverage_qty,
    safety_stock_units: product.min_coverage_qty,
    description: product.description,
    code_frumusa: product.code_frumusa,
    code_country: product.code_country,
    unit_eq: product.unit_eq
  };
  persistOverridesToDisk(current);

  persistCatalogToDisk();

  res.json({
    success: true,
    message: `Producto ${sku} actualizado y guardado permanentemente en el servidor.`,
    product
  });
});

module.exports = router;
module.exports.loadOverridesFromDisk = loadOverridesFromDisk;
module.exports.applyOverridesToProducts = function(products) {
  const overrides = loadOverridesFromDisk();
  if (!overrides || Object.keys(overrides).length === 0) return;
  products.forEach(item => {
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
    }
  });
};
