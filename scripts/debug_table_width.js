const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('http://localhost:8085', { waitUntil: 'networkidle0' });

  // Wait for table
  await page.waitForSelector('#orders-table tbody tr');

  // Evaluate widths
  const info = await page.evaluate(() => {
    const layout = document.querySelector('.app-layout');
    const sidebar = document.querySelector('.app-sidebar');
    const main = document.querySelector('.app-main');
    const card = document.querySelector('.table-card');
    const scrollContainer = document.querySelector('.table-scroll-container');
    const table = document.querySelector('#orders-table');
    
    const ths = Array.from(document.querySelectorAll('#orders-table th')).map(th => ({
      text: th.innerText.trim(),
      width: th.getBoundingClientRect().width,
      computedWidth: window.getComputedStyle(th).width
    }));

    return {
      windowWidth: window.innerWidth,
      layoutWidth: layout ? layout.getBoundingClientRect().width : 0,
      sidebarWidth: sidebar ? sidebar.getBoundingClientRect().width : 0,
      mainWidth: main ? main.getBoundingClientRect().width : 0,
      cardWidth: card ? card.getBoundingClientRect().width : 0,
      scrollContainerWidth: scrollContainer ? scrollContainer.getBoundingClientRect().width : 0,
      tableWidth: table ? table.getBoundingClientRect().width : 0,
      tableComputedWidth: table ? window.getComputedStyle(table).width : 0,
      tableDisplay: table ? window.getComputedStyle(table).display : 0,
      ths
    };
  });

  console.log('--- WIDTH DIAGNOSTICS ---');
  console.log(JSON.stringify(info, null, 2));

  await page.screenshot({ path: 'scratch_table_debug.png' });
  await browser.close();
})();
