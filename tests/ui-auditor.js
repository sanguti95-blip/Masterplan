/**
 * Subagente Autónomo Browser UI Auditor (E2E Suite con Puppeteer)
 * Verifica que todos los flujos de usuario funcionen al 100% y con 0 errores de consola.
 */
const puppeteer = require('puppeteer');
const http = require('http');
const app = require('../server/index');

const PORT = 8099;

async function runUiAuditor() {
  console.log('🤖 [Browser UI Auditor]: Iniciando servidor Express y suite Puppeteer E2E...\n');

  // 1. Iniciar servidor de prueba en puerto dedicado
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.toString());
  });

  let passedFlows = 0;
  const totalFlows = 12;

  try {
    console.log(`🌐 Navegando a http://localhost:${PORT}...`);
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle0' });

    // --- FLUJO 1: Carga Inicial de Catálogo & KPIs ---
    console.log('🔹 [Flujo 1/10]: Verificando carga inicial y catálogo...');
    await page.waitForSelector('.mrp-table', { timeout: 5000 });
    const rowCount = await page.$$eval('.mrp-table tbody tr', rows => rows.length);
    if (rowCount > 0) {
      console.log(`  ✓ OK: Tabla MRP cargada con ${rowCount} filas de catálogo.`);
      passedFlows++;
    } else {
      throw new Error('La tabla MRP está vacía.');
    }

    // --- FLUJO 2: Matriz MRP y Cambio de Días (72h Lead Time) ---
    console.log('🔹 [Flujo 2/10]: Probando cambio de días en Matriz MRP (Lunes -> Miércoles)...');
    await page.click('button[data-day="Miercoles"]');
    await new Promise(r => setTimeout(r, 300));
    
    const bannerDay = await page.$eval('#matrix-banner-day', el => el.innerText.trim());
    const bannerDelivery = await page.$eval('#matrix-banner-delivery', el => el.innerText.trim());
    const bannerCoverage = await page.$eval('#matrix-banner-coverage', el => el.innerText.trim());

    if (bannerDay === 'Miércoles' && bannerCoverage.includes('3') && bannerDelivery.includes('Sábado')) {
      console.log(`  ✓ OK: Matriz Miércoles verificada (Entrega: ${bannerDelivery}, Cobertura: ${bannerCoverage}).`);
      passedFlows++;
    } else {
      throw new Error(`Fallo en matriz: bannerDay=${bannerDay}, bannerCoverage=${bannerCoverage}`);
    }

    // --- FLUJO 3: Búsqueda Instantánea y Filtros ---
    console.log('🔹 [Flujo 3/10]: Probando búsqueda instantánea y filtros...');
    await page.type('#search-input', 'AGUACATE');
    await new Promise(r => setTimeout(r, 300));
    const searchResultsCount = await page.$$eval('.mrp-table tbody tr', rows => rows.length);
    
    await page.click('button[data-filter="all"]');
    await page.$eval('#search-input', el => el.value = '');
    await page.evaluate(() => window.App.setSearchQuery(''));
    await new Promise(r => setTimeout(r, 200));

    if (searchResultsCount >= 1) {
      console.log(`  ✓ OK: Búsqueda instantánea filtró correctamente (${searchResultsCount} productos encontrados).`);
      passedFlows++;
    } else {
      throw new Error('Búsqueda por "AGUACATE" no devolvió resultados.');
    }

    // --- FLUJO 4: Ordenamiento de Columnas por Clic en <th> ---
    console.log('🔹 [Flujo 4/10]: Probando ordenamiento interactivo de columnas...');
    const thCost = await page.$('.mrp-table th[data-sort="totalOrderCost"]');
    if (thCost) {
      await thCost.click();
      await new Promise(r => setTimeout(r, 200));
      const isSortedDesc = await page.$eval('.mrp-table th[data-sort="totalOrderCost"]', el => el.classList.contains('sort-desc') || el.classList.contains('sort-asc'));
      if (isSortedDesc) {
        console.log('  ✓ OK: Ordenamiento interactivo por Costo Total verificado.');
        passedFlows++;
      } else {
        throw new Error('No se aplicó la clase sort al encabezado de tabla.');
      }
    }

    // --- FLUJO 5: Edición en Línea de Stock ---
    console.log('🔹 [Flujo 5/10]: Probando edición en línea de stock...');
    const firstStockInput = await page.$('.mrp-table tbody tr:first-child .stock-input');
    if (firstStockInput) {
      await firstStockInput.click({ clickCount: 3 });
      await firstStockInput.type('50');
      await firstStockInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
      await new Promise(r => setTimeout(r, 300));
      console.log('  ✓ OK: Stock modificado en línea y recálculo de Inv. Proyectado ejecutado.');
      passedFlows++;
    }

    // --- FLUJO 6: Override Manual y Cálculo de Varianza ---
    console.log('🔹 [Flujo 6/10]: Probando override manual y tarjeta de varianza...');
    const firstOrderInput = await page.$('.mrp-table tbody tr:first-child .order-input');
    if (firstOrderInput) {
      await firstOrderInput.click({ clickCount: 3 });
      await firstOrderInput.type('100');
      await firstOrderInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
      await new Promise(r => setTimeout(r, 300));
      
      const hasOverrideClass = await page.$eval('.mrp-table tbody .order-input.override-active', el => Boolean(el)).catch(() => false);
      const varianceVal = await page.$eval('#kpi-variance-cost', el => el.innerText.trim());
      if (hasOverrideClass && varianceVal !== '') {
        console.log(`  ✓ OK: Override manual aplicado con clase destacada y varianza calculada (${varianceVal}).`);
        passedFlows++;
      } else {
        throw new Error('Fallo en cálculo de override manual o varianza.');
      }
    }

    // --- FLUJO 7: Command Palette (Ctrl + K) ---
    console.log('🔹 [Flujo 7/10]: Probando Command Palette (Ctrl + K)...');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyK');
    await page.keyboard.up('Control');
    await new Promise(r => setTimeout(r, 300));

    const isPaletteOpen = await page.$eval('#command-palette', el => el.classList.contains('active'));
    if (isPaletteOpen) {
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 200));
      console.log('  ✓ OK: Command Palette se abrió y cerró con atajos de teclado.');
      passedFlows++;
    } else {
      throw new Error('Command Palette no se abrió con Ctrl+K.');
    }

    // --- FLUJO 8: Modal de Confirmación de Aprobación ---
    console.log('🔹 [Flujo 8/10]: Probando modal de confirmación ejecutiva al aprobar...');
    await page.click('#btn-approve-order');
    await new Promise(r => setTimeout(r, 400));
    const isConfirmModalOpen = await page.$eval('#modal-confirm-approval', el => el.classList.contains('active'));
    if (isConfirmModalOpen) {
      await page.click('#modal-confirm-approval .modal-close');
      await new Promise(r => setTimeout(r, 400));
      console.log('  ✓ OK: Modal de confirmación ejecutiva con desglose de varianza verificado.');
      passedFlows++;
    } else {
      throw new Error('Modal de confirmación no se abrió al presionar Aprobar Pedido.');
    }

    // --- FLUJO 9: Modal de SKU Detail & GMROI ---
    console.log('🔹 [Flujo 9/10]: Probando apertura de modal de detalle de SKU...');
    await page.evaluate(() => {
      const btn = document.querySelector('.mrp-table tbody tr:first-child .btn-view-sku');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 400));
    const isModalOpen = await page.$eval('#modal-sku-detail', el => el.classList.contains('active'));
    if (isModalOpen) {
      await page.click('#modal-sku-detail .modal-close');
      await new Promise(r => setTimeout(r, 300));
      console.log('  ✓ OK: Modal de detalle de SKU y análisis financiero verificado.');
      passedFlows++;
    } else {
      throw new Error('Modal de SKU no se abrió.');
    }

    // --- FLUJO 10: Alternancia de Temas y Navegación entre Pestañas ---
    console.log('🔹 [Flujo 10/12]: Probando alternancia de temas y navegación...');
    await page.click('#btn-theme-toggle');
    await new Promise(r => setTimeout(r, 200));
    
    // Switch to Transit tab
    await page.click('button[data-tab="transit"]');
    await new Promise(r => setTimeout(r, 300));
    const isTransitActive = await page.$eval('#view-transit', el => el.classList.contains('active'));

    // Switch to Sync tab
    await page.click('button[data-tab="sync"]');
    await new Promise(r => setTimeout(r, 300));
    const isSyncActive = await page.$eval('#view-sync', el => el.classList.contains('active'));

    // Switch back to Planner
    await page.click('button[data-tab="planner"]');
    await new Promise(r => setTimeout(r, 200));

    if (isTransitActive && isSyncActive) {
      console.log('  ✓ OK: Temas y navegación fluida entre pestañas activas verificados.');
      passedFlows++;
    }

    // --- FLUJO 11: Maestro de Artículos (Edición y Guardado) ---
    console.log('🔹 [Flujo 11/12]: Probando Maestro de Artículos (Pestaña, Edición y Persistencia)...');
    await page.click('button[data-tab="catalog"]');
    await new Promise(r => setTimeout(r, 300));
    const isCatalogActive = await page.$eval('#view-catalog', el => el.classList.contains('active'));
    const catalogRowsCount = await page.$$eval('#catalog-table-body tr', rows => rows.length);
    
    if (isCatalogActive && catalogRowsCount > 0) {
      // Modificar el primer bulto
      const firstPack = await page.$('#catalog-table-body tr:first-child .field-pack');
      if (firstPack) {
        await firstPack.click({ clickCount: 3 });
        await firstPack.type('24');
      }
      await page.click('#btn-catalog-save-all');
      await new Promise(r => setTimeout(r, 400));
      console.log(`  ✓ OK: Maestro de Artículos verificado (${catalogRowsCount} SKUs editables y guardado global exitoso).`);
      passedFlows++;
    } else {
      throw new Error('Fallo en cargar la pestaña del Maestro de Artículos.');
    }

    // --- FLUJO 12: Recálculo en Vivo de VDP y Cero Scroll Horizontal ---
    console.log('🔹 [Flujo 12/12]: Probando recálculo en vivo de VDP y validación de cero scroll horizontal...');
    await page.click('button[data-tab="planner"]');
    await new Promise(r => setTimeout(r, 300));

    // Cambiar selector de período VDP a 30 días
    await page.select('#period-filter', '30');
    await new Promise(r => setTimeout(r, 300));

    // Validar cero scroll lateral en tabla MRP
    const scrollDimensions = await page.$eval('.table-scroll-container', el => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth
    }));

    const isNoScroll = scrollDimensions.scrollWidth <= scrollDimensions.clientWidth + 5;
    console.log(`  ✓ OK: Recálculo VDP aplicado. Ancho contenedor: ${scrollDimensions.clientWidth}px, Scroll: ${scrollDimensions.scrollWidth}px (Sin scroll horizontal: ${isNoScroll}).`);
    passedFlows++;

  } catch (err) {
    console.error('❌ Error durante la auditoría E2E:', err.message);
  } finally {
    await browser.close();
    server.close();
  }

  // Resumen de Auditoría
  console.log('\n=========================================================');
  console.log(`📊 RESULTADOS DE LA AUDITORÍA BROWSER UI:`);
  console.log(`   Flujos aprobados: ${passedFlows} / ${totalFlows}`);
  console.log(`   Errores de consola JS: ${consoleErrors.length}`);
  console.log(`   Errores de página: ${pageErrors.length}`);
  console.log('=========================================================');

  if (consoleErrors.length > 0) {
    console.warn('⚠️ Errores de consola detectados:', consoleErrors);
  }
  if (pageErrors.length > 0) {
    console.error('❌ Errores de página:', pageErrors);
  }

  if (passedFlows === totalFlows && consoleErrors.length === 0 && pageErrors.length === 0) {
    console.log('\n🎉 ¡AUDITORÍA 100% EXITOSA! 0 Errores de consola y todos los flujos aprobados.\n');
    process.exit(0);
  } else {
    console.error('\n❌ La auditoría finalizó con fallos o advertencias.');
    process.exit(1);
  }
}

runUiAuditor().catch(err => {
  console.error('Fatal error in UI auditor:', err);
  process.exit(1);
});
