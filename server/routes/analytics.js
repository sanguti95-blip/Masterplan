const express = require('express');
const router = express.Router();
const db = require('../db/pool');

// GET /api/analytics/gmroi - 4-Quadrant Strategic GMROI Matrix
router.get('/gmroi', (req, res) => {
  try {
    const products = db.memoryStore.products || [];

    let totalTurnover = 0;
    let validCount = 0;

    const dataPoints = products.map(prod => {
      const price = Number(prod.unit_price || prod.PRECIO || 0);
      const cost = Number(prod.unit_cost || prod.cost || prod.COSTO_UNITARIO || 0);
      const stock = Number(prod.stock_actual !== undefined ? prod.stock_actual : prod.stock || 0);
      const sales = Number(prod.sales_period || prod.ventas || prod.CANTIDAD || 0);
      const sku = prod.code_frumusa || prod.codeFrumusa || prod.NO_ARTI || prod.codeCountry || '';
      const name = prod.description || prod.descripcion || prod.ARTICULO || '';
      const category = prod.category || prod.categoria || 'General';

      // Gross Margin %
      let marginPct = 0;
      if (price > 0 && cost > 0) {
        marginPct = Math.max(0, Math.min(100, ((price - cost) / price) * 100));
      } else if (cost > 0) {
        marginPct = 25; // fallback
      }

      // Inventory Turnover (Rotación estimada)
      const turnover = stock > 0 ? (sales / stock) : (sales > 0 ? 10 : 0);
      if (turnover > 0 && turnover < 100) {
        totalTurnover += turnover;
        validCount++;
      }

      // GMROI Score
      const totalInventoryCost = Math.max(1, stock * cost);
      const grossProfitTotal = Math.max(0, sales * (price - cost));
      const gmroiScore = (grossProfitTotal / totalInventoryCost) * 100;

      return {
        sku,
        name,
        category,
        marginPct: Number(marginPct.toFixed(1)),
        turnover: Number(turnover.toFixed(2)),
        gmroiScore: Number(gmroiScore.toFixed(1)),
        stock,
        sales,
        cost,
        price
      };
    });

    const avgTurnover = validCount > 0 ? (totalTurnover / validCount) : 2.5;
    const marginThreshold = 35; // 35% margin threshold

    // Segment into 4 Quadrants
    const quadrants = {
      stars: [],        // Alto Margen + Alta Rotación
      cashCows: [],     // Bajo Margen + Alta Rotación
      opportunities: [],// Alto Margen + Baja Rotación
      drainers: []      // Bajo Margen + Baja Rotación
    };

    dataPoints.forEach(pt => {
      const isHighMargin = pt.marginPct >= marginThreshold;
      const isHighTurnover = pt.turnover >= avgTurnover;

      if (isHighMargin && isHighTurnover) {
        pt.quadrant = 'Estrellas (Core Stars)';
        pt.quadrantCode = 'stars';
        quadrants.stars.push(pt);
      } else if (!isHighMargin && isHighTurnover) {
        pt.quadrant = 'Vacas Lecheras (Cash Cows)';
        pt.quadrantCode = 'cashCows';
        quadrants.cashCows.push(pt);
      } else if (isHighMargin && !isHighTurnover) {
        pt.quadrant = 'Oportunidades (Opportunities)';
        pt.quadrantCode = 'opportunities';
        quadrants.opportunities.push(pt);
      } else {
        pt.quadrant = 'Drenadores (Drainers)';
        pt.quadrantCode = 'drainers';
        quadrants.drainers.push(pt);
      }
    });

    res.json({
      avgTurnover: Number(avgTurnover.toFixed(2)),
      marginThreshold,
      totalItems: dataPoints.length,
      counts: {
        stars: quadrants.stars.length,
        cashCows: quadrants.cashCows.length,
        opportunities: quadrants.opportunities.length,
        drainers: quadrants.drainers.length
      },
      quadrants,
      dataPoints
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al generar la matriz GMROI.' });
  }
});

// GET /api/analytics/categories - Sales & Margin breakdown by Category
router.get('/categories', (req, res) => {
  try {
    const products = db.memoryStore.products || [];
    const categoryMap = new Map();

    products.forEach(p => {
      // Auto-categorize based on keywords if category is general
      let cat = p.category || p.categoria || '';
      const desc = (p.description || p.descripcion || p.ARTICULO || '').toUpperCase();

      if (!cat || cat === 'General') {
        if (desc.includes('MANZANA') || desc.includes('UVA') || desc.includes('BANANO') || desc.includes('PIÑA') || desc.includes('MELON') || desc.includes('SANDIA') || desc.includes('PAPAYA') || desc.includes('AGUACATE') || desc.includes('LIMON') || desc.includes('NARANJA') || desc.includes('KIWI') || desc.includes('PERA') || desc.includes('CIRUELA') || desc.includes('MANGA')) {
          cat = 'Frutas Frescas';
        } else if (desc.includes('LECHUGA') || desc.includes('ESPINACA') || desc.includes('APIO') || desc.includes('CULANTRO') || desc.includes('PEREJIL') || desc.includes('REPOLLO') || desc.includes('BROCOLI') || desc.includes('COLIFLOR') || desc.includes('MOSTAZA')) {
          cat = 'Hortalizas y Hojas';
        } else if (desc.includes('PAPA') || desc.includes('CEBOLLA') || desc.includes('ZANAHORIA') || desc.includes('YUCA') || desc.includes('CAMOTE') || desc.includes('REMOLACHA') || desc.includes('TIQUISQUE') || desc.includes('NAMPI')) {
          cat = 'Tubérculos y Raíces';
        } else if (desc.includes('TOMATE') || desc.includes('CHILE') || desc.includes('PEPINO') || desc.includes('CHAYOTE') || desc.includes('AYOTE') || desc.includes('BERENJENA') || desc.includes('ZAPALLO')) {
          cat = 'Vegetales de Fruto';
        } else if (desc.includes('OREGANO') || desc.includes('ROMERO') || desc.includes('HIERBA') || desc.includes('AJO') || desc.includes('JENJIBRE') || desc.includes('ALFALFA')) {
          cat = 'Hierbas y Aromáticas';
        } else {
          cat = 'Otros Perecederos';
        }
      }

      const sales = Number(p.sales_period || p.ventas || p.CANTIDAD || 0);
      const price = Number(p.unit_price || p.PRECIO || 0);
      const cost = Number(p.unit_cost || p.cost || p.COSTO_UNITARIO || 0);
      const stock = Number(p.stock_actual !== undefined ? p.stock_actual : p.stock || 0);
      const revenue = sales * (price > 0 ? price : cost * 1.3);
      const stockVal = stock * cost;
      const profit = sales * Math.max(0, (price > 0 ? price : cost * 1.3) - cost);

      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, {
          category: cat,
          skusCount: 0,
          totalSalesUnits: 0,
          totalRevenue: 0,
          totalStockValue: 0,
          totalProfit: 0
        });
      }

      const entry = categoryMap.get(cat);
      entry.skusCount++;
      entry.totalSalesUnits += sales;
      entry.totalRevenue += revenue;
      entry.totalStockValue += stockVal;
      entry.totalProfit += profit;
    });

    const categories = Array.from(categoryMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);

    res.json({ categories });
  } catch (error) {
    res.status(500).json({ error: 'Error al calcular desglose por categoría.' });
  }
});

// GET /api/analytics/capital-efficiency - Stock Value vs Gross Margin Generated
router.get('/capital-efficiency', (req, res) => {
  try {
    const products = db.memoryStore.products || [];

    const efficiencyList = products.map(p => {
      const sku = p.code_frumusa || p.codeFrumusa || p.NO_ARTI || p.codeCountry || '';
      const name = p.description || p.descripcion || p.ARTICULO || '';
      const cost = Number(p.unit_cost || p.cost || p.COSTO_UNITARIO || 0);
      const price = Number(p.unit_price || p.PRECIO || (cost * 1.3));
      const stock = Number(p.stock_actual !== undefined ? p.stock_actual : p.stock || 0);
      const sales = Number(p.sales_period || p.ventas || p.CANTIDAD || 0);

      const investedCapital = stock * cost;
      const grossMarginGenerated = sales * Math.max(0, price - cost);
      const roiRatio = investedCapital > 0 ? (grossMarginGenerated / investedCapital) : 1;

      return {
        sku,
        name,
        investedCapital: Number(investedCapital.toFixed(2)),
        grossMarginGenerated: Number(grossMarginGenerated.toFixed(2)),
        roiRatio: Number(roiRatio.toFixed(2))
      };
    }).sort((a, b) => b.grossMarginGenerated - a.grossMarginGenerated).slice(0, 15);

    res.json({ efficiencyList });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener eficiencia de capital.' });
  }
});

module.exports = router;
