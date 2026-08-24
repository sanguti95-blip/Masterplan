const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  await page.goto('http://localhost:8085', { waitUntil: 'networkidle0' });

  console.log('--- Test: Enable / Disable SKU in Maestro de Artículos ---');

  // 1. Switch to Catalog Tab
  await page.click('button[data-tab="catalog"]');
  await new Promise(r => setTimeout(r, 400));

  const totalCatalogRows = await page.$$eval('#catalog-table-body tr[data-sku]', rows => rows.length);
  console.log(`Total SKUs in Maestro: ${totalCatalogRows}`);

  // 2. Get first SKU
  const firstSku = await page.$eval('#catalog-table-body tr[data-sku]:first-child', el => el.dataset.sku);
  console.log(`Testing toggle on SKU: ${firstSku}`);

  // 3. Toggle SKU to Inactivo
  await page.click('#catalog-table-body tr[data-sku]:first-child .btn-status-toggle');
  await new Promise(r => setTimeout(r, 400));

  const isInactive = await page.$eval('#catalog-table-body tr[data-sku]:first-child .btn-status-toggle', el => el.classList.contains('status-inactive'));
  console.log(`SKU ${firstSku} button is now status-inactive: ${isInactive}`);

  // 4. Switch to Planner tab and verify SKU is hidden
  await page.click('button[data-tab="planner"]');
  await new Promise(r => setTimeout(r, 400));

  const isSkuInPlanner = await page.$eval(`#orders-table tbody tr[data-sku="${firstSku}"]`, el => Boolean(el)).catch(() => false);
  console.log(`SKU ${firstSku} present in MRP Planning Table: ${isSkuInPlanner} (should be false)`);

  if (isSkuInPlanner) {
    console.error('❌ FAILED: Inactive SKU still visible in MRP table!');
    process.exit(1);
  }

  // 5. Switch back to Catalog tab and Reactivate SKU
  await page.click('button[data-tab="catalog"]');
  await new Promise(r => setTimeout(r, 400));

  // Change filter to 'all' or 'inactive' to see it
  await page.select('#catalog-status-filter', 'all');
  await new Promise(r => setTimeout(r, 300));

  await page.click(`#catalog-table-body tr[data-sku="${firstSku}"] .btn-status-toggle`);
  await new Promise(r => setTimeout(r, 400));

  const isReactivated = await page.$eval(`#catalog-table-body tr[data-sku="${firstSku}"] .btn-status-toggle`, el => el.classList.contains('status-active'));
  console.log(`SKU ${firstSku} button is now status-active again: ${isReactivated}`);

  // 6. Switch to Planner tab and verify SKU is back
  await page.click('button[data-tab="planner"]');
  await new Promise(r => setTimeout(r, 400));

  const isSkuBackInPlanner = await page.$eval(`#orders-table tbody tr[data-sku="${firstSku}"]`, el => Boolean(el)).catch(() => false);
  console.log(`SKU ${firstSku} back in MRP Planning Table: ${isSkuBackInPlanner} (should be true)`);

  if (!isSkuBackInPlanner) {
    console.error('❌ FAILED: Reactivated SKU did not reappear in MRP table!');
    process.exit(1);
  }

  console.log('\n🎉 ALL ENABLE / DISABLE TESTS PASSED 100%!');
  await browser.close();
})();
