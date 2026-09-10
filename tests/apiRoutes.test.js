const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server/index');
const db = require('../server/db/pool');
const http = require('http');

const fs = require('fs');
const path = require('path');

let server;
let baseUrl;

describe('API Routes & Relational Order Lifecycle - Test Suite', () => {
  before(async () => {
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    if (db.pool) {
      await db.query("DELETE FROM mrp_order_receptions WHERE order_id LIKE 'ORD-TEST-%'").catch(() => {});
      await db.query("DELETE FROM mrp_purchase_orders WHERE id LIKE 'ORD-TEST-%'").catch(() => {});
      await db.pool.end().catch(() => {});
    }
    try {
      const p = path.resolve(process.cwd(), 'data/active_orders.json');
      if (fs.existsSync(p)) {
        const ords = JSON.parse(fs.readFileSync(p, 'utf8')).filter(o => !o.id.startsWith('ORD-TEST-'));
        fs.writeFileSync(p, JSON.stringify(ords, null, 2), 'utf8');
      }
    } catch(e) {}
  });

  test('GET /api/health retorna estado online', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'online');
    assert.ok(data.timestamp);
  });

  test('GET /api/planning/transit retorna pedidos en tránsito', async () => {
    const res = await fetch(`${baseUrl}/api/planning/transit`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.orders));
    assert.equal(typeof data.totalActiveOrders, 'number');
  });

  test('POST /api/planning/approve crea una nueva orden en tránsito', async () => {
    const testOrderId = `ORD-TEST-${Date.now()}`;
    const payload = {
      executionDay: 'Lunes',
      order: {
        id: testOrderId,
        orderCode: testOrderId
      },
      items: [
        {
          codeSku: 'TEST-SKU-99',
          description: 'Cebolla Test',
          finalQty: 50,
          packMultiple: 10,
          unitCost: 600
        }
      ],
      notes: 'Orden de prueba de integración'
    };

    const res = await fetch(`${baseUrl}/api/planning/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.order.id, testOrderId);
    assert.equal(data.order.totalUnits, 50);
    assert.equal(data.order.totalBoxes, 5);
    assert.equal(data.order.status, 'EN_TRANSITO');

    // Test receiving this order
    const receiveRes = await fetch(`${baseUrl}/api/planning/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: testOrderId,
        receivedBy: 'Bodeguero Milton Test',
        notes: 'Llegaron 5 cajas completas',
        itemsReceived: [
          {
            codeSku: 'TEST-SKU-99',
            boxesReceived: 5,
            unitsReceived: 50
          }
        ]
      })
    });

    assert.equal(receiveRes.status, 200);
    const receiveData = await receiveRes.json();
    assert.equal(receiveData.success, true);
    assert.equal(receiveData.status, 'RECEPCIONADO');
    assert.equal(receiveData.totalBoxesReceived, 5);
  });

  test('GET /api/planning/receptions retorna historial de recepciones', async () => {
    const res = await fetch(`${baseUrl}/api/planning/receptions`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.receptions));
  });

});
