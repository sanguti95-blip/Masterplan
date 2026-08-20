const express = require('express');
const router = express.Router();
const db = require('../db/pool');

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

// GET /api/products/:sku - Get specific SKU detail
router.get('/:sku', (req, res) => {
  const sku = req.params.sku.toString().trim();
  const product = (db.memoryStore.products || []).find(p => (
    (p.code_frumusa && p.code_frumusa.toString() === sku) ||
    (p.codeFrumusa && p.codeFrumusa.toString() === sku) ||
    (p.NO_ARTI && p.NO_ARTI.toString() === sku) ||
    (p.code_country && p.code_country.toString() === sku) ||
    (p.codeCountry && p.codeCountry.toString() === sku)
  ));

  if (!product) {
    return res.status(404).json({ error: `Producto ${sku} no encontrado.` });
  }

  res.json({ product });
});

// PUT /api/products/:sku - Update product parameters (Stock, Transit, Safety Stock, Multiple)
router.put('/:sku', (req, res) => {
  const sku = req.params.sku.toString().trim();
  const product = (db.memoryStore.products || []).find(p => (
    (p.code_frumusa && p.code_frumusa.toString() === sku) ||
    (p.codeFrumusa && p.codeFrumusa.toString() === sku) ||
    (p.NO_ARTI && p.NO_ARTI.toString() === sku) ||
    (p.code_country && p.code_country.toString() === sku) ||
    (p.codeCountry && p.codeCountry.toString() === sku)
  ));

  if (!product) {
    return res.status(404).json({ error: `Producto ${sku} no encontrado.` });
  }

  const { stockActual, transitQty, packMultiple, safetyStockDays, unitCost } = req.body;

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
    product.multiplo = product.pack_multiple;
  }
  if (safetyStockDays !== undefined) {
    product.safety_stock_days = Number(safetyStockDays);
    product.coberturaMeta = product.safety_stock_days;
  }
  if (unitCost !== undefined) {
    product.unit_cost = Number(unitCost);
    product.cost = Number(unitCost);
  }

  res.json({
    success: true,
    message: `Producto ${sku} actualizado con éxito.`,
    product
  });
});

module.exports = router;
