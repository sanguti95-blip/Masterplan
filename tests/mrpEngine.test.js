const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const mrpEngine = require('../server/services/mrpEngine');

describe('Pure MRP Engine 3.0 - Test Suite', () => {

  describe('Pilar 1: VDP y Des-restricción por Quiebre de Stock', () => {
    test('Calcula VDP normal cuando hay stock disponible', () => {
      const product = {
        code_frumusa: 'TEST-01',
        description: 'Tomate Primera',
        stock_actual: 50,
        sales_period: 300,
        days_period: 30
      };
      const result = mrpEngine.calculateSkuReplenishment(product, 'Lunes');
      assert.equal(result.rawVdp, 10);
      assert.equal(result.isStockout, false);
      assert.equal(result.unconstrainedFactor, 1.0);
      assert.equal(result.vdp, 10);
    });

    test('Aplica factor de des-restricción (+15%) cuando stock está en 0 y hay ventas', () => {
      const product = {
        code_frumusa: 'TEST-02',
        description: 'Aguacate Hass',
        stock_actual: 0,
        sales_period: 300,
        days_period: 30
      };
      const result = mrpEngine.calculateSkuReplenishment(product, 'Lunes');
      assert.equal(result.rawVdp, 10);
      assert.equal(result.isStockout, true);
      assert.equal(result.unconstrainedFactor, 1.15);
      assert.equal(result.vdp, 11.5);
    });

    test('No aplica des-restricción si stock es 0 y ventas son 0', () => {
      const product = {
        code_frumusa: 'TEST-03',
        description: 'Item Sin Movimiento',
        stock_actual: 0,
        sales_period: 0,
        days_period: 30
      };
      const result = mrpEngine.calculateSkuReplenishment(product, 'Lunes');
      assert.equal(result.rawVdp, 0);
      assert.equal(result.isStockout, false);
      assert.equal(result.vdp, 0);
    });
  });

  describe('Pilar 2: Demanda Ponderada del Ciclo (Matriz Semanal)', () => {
    const baseProduct = {
      code_frumusa: 'TEST-WEEK',
      description: 'Zanahoria',
      stock_actual: 10,
      vdp: 10,
      pack_multiple: 1
    };

    test('Lunes cubre Jueves (Factor 0.89x)', () => {
      const result = mrpEngine.calculateSkuReplenishment(baseProduct, 'Lunes');
      assert.equal(result.daysToCover, 1);
      assert.equal(result.demandWeight, 0.89);
      assert.equal(result.cycleDemand, 8.9);
      assert.equal(result.deliveryDay, 'Jueves');
    });

    test('Martes cubre Viernes (Factor 0.88x)', () => {
      const result = mrpEngine.calculateSkuReplenishment(baseProduct, 'Martes');
      assert.equal(result.daysToCover, 1);
      assert.equal(result.demandWeight, 0.88);
      assert.equal(result.cycleDemand, 8.8);
      assert.equal(result.deliveryDay, 'Viernes');
    });

    test('Miércoles cubre Fin de Semana: Sábado, Domingo, Lunes (Pico 3.55x)', () => {
      const result = mrpEngine.calculateSkuReplenishment(baseProduct, 'Miercoles');
      assert.equal(result.daysToCover, 3);
      assert.equal(result.demandWeight, 3.55);
      assert.equal(result.cycleDemand, 35.5);
      assert.equal(result.deliveryDay, 'Sábado');
    });

    test('Jueves cubre Valle: Martes y Miércoles (Factor 1.84x)', () => {
      const result = mrpEngine.calculateSkuReplenishment(baseProduct, 'Jueves');
      assert.equal(result.daysToCover, 2);
      assert.equal(result.demandWeight, 1.84);
      assert.equal(result.cycleDemand, 18.4);
      assert.equal(result.deliveryDay, 'Martes');
    });
  });

  describe('Pilar 3 & Casos Borde: Ajo Pelado y Riesgo de Caducidad', () => {
    test('Ajo Pelado con 45 unidades de stock y VDP 1.58 NO DEBE sugerir pedido (Sugerido = 0)', () => {
      const ajoPelado = {
        code_country: '700',
        code_frumusa: '781',
        description: 'AJO PELADO',
        category: 'Hierbas y Aromáticas',
        stock_actual: 45,
        vdp: 1.58,
        pack_multiple: 10,
        unit_cost: 1500
      };

      const result = mrpEngine.calculateSkuReplenishment(ajoPelado, 'Lunes');

      // Inventario actual (45) ya cubre 28.5 días, superando los 21 días de vida útil
      assert.equal(result.projectedStock, 45);
      assert.equal(result.suggestedUnits, 0, 'Ajo Pelado no debe pedir nada porque tiene sobrestock masivo');
      assert.equal(result.suggestedBoxes, 0);
      assert.equal(result.baseOrder, 0);
      assert.ok(result.coverageDaysResult > 21, 'Cobertura actual excede vida útil de 21 días');
    });

    test('Alerta de caducidad se activa si el pedido resultante excede la vida útil', () => {
      const lechuga = {
        code_frumusa: 'LECH-01',
        description: 'Lechuga Americana',
        category: 'Hojas Verdes',
        stock_actual: 5,
        vdp: 2, // Vida útil hojas verdes = 4 días. Capacidad máx = 8 unidades
        pack_multiple: 20 // Empaque forzado de 20
      };

      const result = mrpEngine.calculateSkuReplenishment(lechuga, 'Lunes');
      // Si se pidieran 20, inventario final = 25 -> 25 / 2 = 12.5 días > 4 días vida útil
      assert.equal(result.isOverShelfLife, true);
      assert.ok(result.shelfLifeWarning !== null);
      assert.match(result.shelfLifeWarning, /Riesgo de Caducidad/i);
    });
  });

  describe('Pilar 4 & 5: Inventario Proyectado, Tránsito y Faltante Neto', () => {
    test('Deduce correctamente el inventario en tránsito activo', () => {
      const activeOrders = [
        {
          id: 'ORD-TEST-01',
          status: 'EN_TRANSITO',
          items: [
            { code_frumusa: 'CHILE-Q', final_qty: 60 }
          ]
        }
      ];

      const product = {
        code_frumusa: 'CHILE-Q',
        description: 'Chile Quetzal',
        stock_actual: 20,
        vdp: 10,
        pack_multiple: 10
      };

      const result = mrpEngine.calculateSkuReplenishment(product, 'Lunes', activeOrders);
      assert.equal(result.stockActual, 20);
      assert.equal(result.activeTransit, 60);
      assert.equal(result.projectedStock, 80); // 20 + 60
    });

    test('Chile Quetzal redondea exactamente al bulto cerrado de empaque', () => {
      const chileQuetzal = {
        code_frumusa: 'CHILE-Q',
        description: 'Chile Quetzal',
        stock_actual: 10,
        vdp: 25,
        pack_multiple: 120, // Empaque cerrado de 120 unidades
        unit_cost: 150
      };

      const result = mrpEngine.calculateSkuReplenishment(chileQuetzal, 'Miercoles'); // Demanda 3.55x = 88.75 + SS
      assert.ok(result.suggestedUnits % 120 === 0, 'El pedido sugerido debe ser múltiplo exacto de 120');
      assert.ok(result.suggestedBoxes >= 1, 'Debe sugerir al menos 1 bulto cerrado');
      assert.equal(result.suggestedUnits, result.suggestedBoxes * 120);
    });
  });

  describe('Pilar 6: Overrides Manuales y Prioridad del Planificador', () => {
    test('Respeta override manual de pedido final si fue digitado explícitamente', () => {
      const product = {
        code_frumusa: 'TEST-OVERRIDE',
        description: 'Papaya',
        stock_actual: 100,
        vdp: 1,
        pack_multiple: 5,
        pedidoFinalOverride: 15 // Planificador decidió forzar 15 aunque el algoritmo sugiera 0
      };

      const result = mrpEngine.calculateSkuReplenishment(product, 'Lunes');
      assert.equal(result.suggestedUnits, 0); // Algoritmo frío sugiere 0
      assert.equal(result.manualOverride, 15);
      assert.equal(result.finalQty, 15); // Cantidad final adopta el override del usuario
      assert.equal(result.finalBoxes, 3); // 15 / 5 = 3 cajas
    });

    test('Respeta override de stock de seguridad mínimo por artículo', () => {
      const product = {
        code_frumusa: 'TEST-SS',
        description: 'Cebolla Morada',
        stock_actual: 0,
        vdp: 5,
        pack_multiple: 1,
        min_coverage_qty: 30 // Min coverage fijado en 30
      };

      const result = mrpEngine.calculateSkuReplenishment(product, 'Lunes');
      assert.equal(result.minCoverageUnits, 30);
      assert.ok(result.targetStockUnits >= 30);
    });
  });

});
