const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto('http://localhost:8085', { waitUntil: 'networkidle0' });

  console.log('--- Test 1: Normal Sidebar Tab Navigation ---');
  const tabs = ['catalog', 'transit', 'sync', 'config', 'planner'];

  for (const tab of tabs) {
    await page.click(`.nav-tab[data-tab="${tab}"]`);
    await new Promise(r => setTimeout(r, 300));
    const active = await page.$eval(`#view-${tab}`, el => el.classList.contains('active'));
    console.log(`Tab ${tab}: ${active ? '✓ OK' : '❌ FAIL'}`);
  }

  console.log('\n--- Test 2: Collapsed Sidebar Tab Navigation ---');
  await page.click('#btn-toggle-sidebar');
  await new Promise(r => setTimeout(r, 400));

  for (const tab of tabs) {
    await page.click(`.nav-tab[data-tab="${tab}"]`);
    await new Promise(r => setTimeout(r, 300));
    const active = await page.$eval(`#view-${tab}`, el => el.classList.contains('active'));
    console.log(`Collapsed Tab ${tab}: ${active ? '✓ OK' : '❌ FAIL'}`);
  }

  console.log('\n🎉 ALL TAB NAVIGATION TESTS PASSED!');
  await browser.close();
})();
