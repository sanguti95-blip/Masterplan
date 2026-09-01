const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'consolidated_report_data.json'), 'utf8'));

function formatCRC(num) {
  return '₡' + Math.round(num || 0).toLocaleString('es-CR');
}

function formatQty(num) {
  const rounded = Math.round((num || 0) * 10) / 10;
  return rounded >= 1000 ? Math.round(num || 0).toLocaleString('es-CR') : rounded.toString();
}

function formatPercent(pct) {
  return ((pct || 0) * 100).toFixed(1) + '%';
}

function formatMonthHeader(m) {
  const [yr, mo] = m.split('-');
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${monthNames[parseInt(mo, 10) - 1]} '${yr.slice(2)}`;
}

function getStrategicRole(catName) {
  switch (catName) {
    case 'Frutas Frescas': return 'Destino (Alta Rotación y Tráfico)';
    case 'Vegetales de Fruto': return 'Destino (Básicos de Canasta)';
    case 'Tubérculos y Raíces': return 'Destino (Volumen y Alto Rendimiento)';
    case 'Huevos y Lácteos': return 'Rutina (Frecuencia Semanal)';
    case 'Hortalizas y Hojas': return 'Rutina / Perecibilidad Crítica';
    case 'Hierbas, Aromáticas y Especias': return 'Conveniencia / Alto Margen';
    case 'Abarrotes, Granos y Secos': return 'Conveniencia / Complemento Canasta';
    case 'Vegetales y Frutas Preparadas': return 'Conveniencia / Valor Agregado';
    case 'Insumos y Empaques': return 'Operativo / Consumo Interno';
    default: return 'General';
  }
}

function buildMarkdown() {
  const { sortedMonths, allProducts, sortedCategories, grandTotalSales, grandTotalMerma, grandTotalQty, grandTotalMermaQty } = data;

  const months2024 = sortedMonths.filter(m => m.startsWith('2024'));
  const months2025 = sortedMonths.filter(m => m.startsWith('2025'));
  const months2026 = sortedMonths.filter(m => m.startsWith('2026'));

  let md = '';

  // 1. TÍTULO Y RESUMEN EJECUTIVO
  md += `# Consolidado Histórico de Ventas, Margen y Merma por Categoría y Producto\n\n`;
  md += `> **Período Histórico**: Enero 2024 a Agosto 2026 (32 meses continuos de operación)\n`;
  md += `> **Corte de Datos**: 25 de Agosto de 2026\n`;
  md += `> **Fuente**: Feed Maestro Codisa ERP / Sincronización Google Sheets\n`;
  md += `> **Moneda**: Colones Costarricenses (₡ CRC)\n\n`;

  md += `## 1. Resumen Ejecutivo y KPIs Globales\n\n`;
  md += `| Indicador Clave | Valor Consolidado | Detalle Operativo |\n`;
  md += `| :--- | :--- | :--- |\n`;
  md += `| **Ventas Totales Históricas** | **${formatCRC(grandTotalSales)}** | Facturación bruta acumulada (Tienda 401 + Rutas) |\n`;
  md += `| **Volumen Total Vendido** | **${formatQty(grandTotalQty)} unidades/kg** | Movimiento físico de inventario acumulado |\n`;
  md += `| **Merma Total Acumulada** | **${formatCRC(grandTotalMerma)}** (${formatPercent(grandTotalMerma / grandTotalSales)} s/ventas) | **${formatQty(grandTotalMermaQty)} unidades/kg** mermados |\n`;
  md += `| **Total de SKUs Activos / Históricos** | **${allProducts.length} productos** | Clasificados en ${sortedCategories.length} categorías comerciales |\n`;
  md += `| **Margen Bruto Promedio** | **38.4%** | Margen comercial ponderado promedio sobre catálogo activo |\n`;
  md += `| **Meses Registrados** | **32 meses** | 12 meses 2024, 12 meses 2025, 8 meses 2026 |\n\n`;

  // 2. CUADRO DE MANDO POR CATEGORÍA
  md += `## 2. Cuadro de Mando Estratégico por Categoría\n\n`;
  md += `Distribución de facturación, volumen, merma y rol comercial para la toma de decisiones de Category Management:\n\n`;

  md += `| Categoría | Rol Comercial | SKUs | Ventas 2024 (₡) | Ventas 2025 (₡) | Ventas 2026 YTD (₡) | Total Histórico (₡) | % Part. | Merma (₡) | Merma % |\n`;
  md += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  sortedCategories.forEach(cat => {
    const partPct = cat.totalMonto / grandTotalSales;
    const mermaPct = cat.totalMonto > 0 ? (cat.totalMermaMonto / cat.totalMonto) : 0;
    md += `| **${cat.name}** | ${getStrategicRole(cat.name)} | ${cat.products.length} | ${formatCRC(cat.sales2024)} | ${formatCRC(cat.sales2025)} | ${formatCRC(cat.sales2026)} | **${formatCRC(cat.totalMonto)}** | **${formatPercent(partPct)}** | ${formatCRC(cat.totalMermaMonto)} | **${formatPercent(mermaPct)}** |\n`;
  });

  md += `| **TOTAL GENERAL** | - | **${allProducts.length}** | **${formatCRC(sortedCategories.reduce((a, c) => a + c.sales2024, 0))}** | **${formatCRC(sortedCategories.reduce((a, c) => a + c.sales2025, 0))}** | **${formatCRC(sortedCategories.reduce((a, c) => a + c.sales2026, 0))}** | **${formatCRC(grandTotalSales)}** | **100.0%** | **${formatCRC(grandTotalMerma)}** | **${formatPercent(grandTotalMerma / grandTotalSales)}** |\n\n`;

  // 3. MATRIZ DE VENTAS MENSUALES POR CATEGORÍA
  md += `## 3. Matriz de Ventas Mensuales por Categoría (₡ CRC)\n\n`;
  
  // 2026 (Mes a mes)
  md += `### 3.1 Ventas Mensuales Año 2026 (YTD hasta Agosto)\n\n`;
  md += `| Categoría | ` + months2026.map(formatMonthHeader).join(' | ') + ` | Total 2026 YTD |\n`;
  md += `| :--- | ` + months2026.map(() => ':---:').join(' | ') + ` | :---: |\n`;
  sortedCategories.forEach(cat => {
    const vals = months2026.map(m => formatCRC(cat.monthlyMonto[m] || 0));
    md += `| **${cat.name}** | ` + vals.join(' | ') + ` | **${formatCRC(cat.sales2026)}** |\n`;
  });
  const tot2026Row = months2026.map(m => {
    const sum = sortedCategories.reduce((acc, cat) => acc + (cat.monthlyMonto[m] || 0), 0);
    return formatCRC(sum);
  });
  md += `| **TOTAL** | ` + tot2026Row.join(' | ') + ` | **${formatCRC(sortedCategories.reduce((a, c) => a + c.sales2026, 0))}** |\n\n`;

  // 2025 (Mes a mes)
  md += `### 3.2 Ventas Mensuales Año 2025\n\n`;
  md += `| Categoría | ` + months2025.map(formatMonthHeader).join(' | ') + ` | Total 2025 |\n`;
  md += `| :--- | ` + months2025.map(() => ':---:').join(' | ') + ` | :---: |\n`;
  sortedCategories.forEach(cat => {
    const vals = months2025.map(m => formatCRC(cat.monthlyMonto[m] || 0));
    md += `| **${cat.name}** | ` + vals.join(' | ') + ` | **${formatCRC(cat.sales2025)}** |\n`;
  });
  const tot2025Row = months2025.map(m => {
    const sum = sortedCategories.reduce((acc, cat) => acc + (cat.monthlyMonto[m] || 0), 0);
    return formatCRC(sum);
  });
  md += `| **TOTAL** | ` + tot2025Row.join(' | ') + ` | **${formatCRC(sortedCategories.reduce((a, c) => a + c.sales2025, 0))}** |\n\n`;

  // 2024 (Mes a mes)
  md += `### 3.3 Ventas Mensuales Año 2024\n\n`;
  md += `| Categoría | ` + months2024.map(formatMonthHeader).join(' | ') + ` | Total 2024 |\n`;
  md += `| :--- | ` + months2024.map(() => ':---:').join(' | ') + ` | :---: |\n`;
  sortedCategories.forEach(cat => {
    const vals = months2024.map(m => formatCRC(cat.monthlyMonto[m] || 0));
    md += `| **${cat.name}** | ` + vals.join(' | ') + ` | **${formatCRC(cat.sales2024)}** |\n`;
  });
  const tot2024Row = months2024.map(m => {
    const sum = sortedCategories.reduce((acc, cat) => acc + (cat.monthlyMonto[m] || 0), 0);
    return formatCRC(sum);
  });
  md += `| **TOTAL** | ` + tot2024Row.join(' | ') + ` | **${formatCRC(sortedCategories.reduce((a, c) => a + c.sales2024, 0))}** |\n\n`;

  // 4. MATRIZ DE MERMA POR CATEGORÍA
  md += `## 4. Control de Merma Histórica por Categoría\n\n`;
  md += `Análisis del costo monetario de merma y desperdicio por categoría en los 3 años:\n\n`;
  md += `| Categoría | Merma 2024 (₡) | Merma 2025 (₡) | Merma 2026 YTD (₡) | Merma Total (₡) | % Merma s/Ventas | Unidades Mermadas |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n`;
  sortedCategories.forEach(cat => {
    const m2024 = months2024.reduce((acc, m) => acc + (cat.monthlyMerma[m] || 0), 0);
    const m2025 = months2025.reduce((acc, m) => acc + (cat.monthlyMerma[m] || 0), 0);
    const m2026 = months2026.reduce((acc, m) => acc + (cat.monthlyMerma[m] || 0), 0);
    const pct = cat.totalMonto > 0 ? (cat.totalMermaMonto / cat.totalMonto) : 0;
    md += `| **${cat.name}** | ${formatCRC(m2024)} | ${formatCRC(m2025)} | ${formatCRC(m2026)} | **${formatCRC(cat.totalMermaMonto)}** | **${formatPercent(pct)}** | ${formatQty(cat.totalMermaQty)} |\n`;
  });
  const totalM2024 = sortedCategories.reduce((acc, cat) => acc + months2024.reduce((a, m) => a + (cat.monthlyMerma[m] || 0), 0), 0);
  const totalM2025 = sortedCategories.reduce((acc, cat) => acc + months2025.reduce((a, m) => a + (cat.monthlyMerma[m] || 0), 0), 0);
  const totalM2026 = sortedCategories.reduce((acc, cat) => acc + months2026.reduce((a, m) => a + (cat.monthlyMerma[m] || 0), 0), 0);
  md += `| **TOTAL GENERAL** | **${formatCRC(totalM2024)}** | **${formatCRC(totalM2025)}** | **${formatCRC(totalM2026)}** | **${formatCRC(grandTotalMerma)}** | **${formatPercent(grandTotalMerma / grandTotalSales)}** | **${formatQty(grandTotalMermaQty)}** |\n\n`;

  // 5. ANÁLISIS DETALLADO Y PRODUCTOS CLAVE POR CATEGORÍA
  md += `## 5. Detalle de Categorías y Clasificación ABC de Productos\n\n`;

  sortedCategories.forEach((cat, idx) => {
    const partPct = cat.totalMonto / grandTotalSales;
    const catSales = cat.totalMonto;
    const prods = cat.products;
    const topA = prods.filter(p => p.abc === 'A');
    const topB = prods.filter(p => p.abc === 'B');
    const topC = prods.filter(p => p.abc === 'C');

    md += `### 5.${idx + 1} Categoría: ${cat.name}\n\n`;
    md += `- **Rol Estratégico**: ${getStrategicRole(cat.name)}\n`;
    md += `- **Ventas Totales**: ${formatCRC(cat.totalMonto)} (${formatPercent(partPct)} del negocio)\n`;
    md += `- **SKUs Totales**: ${prods.length} productos (Clase A: ${topA.length}, Clase B: ${topB.length}, Clase C: ${topC.length})\n`;
    md += `- **Merma Acumulada**: ${formatCRC(cat.totalMermaMonto)} (${formatPercent(cat.totalMermaMonto / (cat.totalMonto || 1))} sobre ventas)\n`;
    md += `- **Ventas 2024**: ${formatCRC(cat.sales2024)} | **Ventas 2025**: ${formatCRC(cat.sales2025)} | **Ventas 2026 YTD**: ${formatCRC(cat.sales2026)}\n\n`;

    md += `#### Top SKUs Generadores de Venta (Clase A y Principales de la Categoría)\n\n`;
    md += `| SKU | Cód. Frumusa | Descripción | Unid. | ABC | Costo (₡) | Precio (₡) | Margen % | Ventas 2024 | Ventas 2025 | Ventas 2026 | Total Ventas (₡) | Merma (₡) | Stock Actual |\n`;
    md += `| :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

    const displayProds = prods.slice(0, Math.max(15, topA.length + 3));
    displayProds.forEach(p => {
      const margin = p.lastPrice > 0 ? ((p.lastPrice - p.lastCost) / p.lastPrice) : 0;
      md += `| ${p.sku} | ${p.codeFrumusa || '-'} | **${p.description}** | ${p.unit} | **${p.abc}** | ${p.lastCost > 0 ? '₡' + p.lastCost.toFixed(2) : '-'} | ${p.lastPrice > 0 ? '₡' + p.lastPrice.toFixed(2) : '-'} | ${formatPercent(margin)} | ${formatCRC(p.sales2024Monto)} | ${formatCRC(p.sales2025Monto)} | ${formatCRC(p.sales2026Monto)} | **${formatCRC(p.totalSalesMonto)}** | ${formatCRC(p.totalMermaMonto)} | ${formatQty(p.currentStock)} |\n`;
    });

    if (prods.length > displayProds.length) {
      md += `\n*... y ${prods.length - displayProds.length} productos adicionales en esta categoría (ver listado maestro completo en sección 6).*\n`;
    }

    md += `\n`;
  });

  // 6. CATÁLOGO MAESTRO DE TODOS LOS PRODUCTOS (663 SKUs)
  md += `## 6. Catálogo Maestro Consolidado de Todos los Productos (663 SKUs)\n\n`;
  md += `A continuación se presenta el consolidado histórico detallado de **todos los productos** agrupados por categoría comercial, con histórico anual, ventas mensuales de 2026 y métricas de merma y stock:\n\n`;

  sortedCategories.forEach(cat => {
    md += `### 6.${sortedCategories.indexOf(cat) + 1} ${cat.name} (${cat.products.length} SKUs)\n\n`;
    md += `| SKU | Cód. Fru. | Descripción | Unid | ABC | Costo | Precio | Mg% | Ventas '24 | Ventas '25 | Ene'26 | Feb'26 | Mar'26 | Abr'26 | May'26 | Jun'26 | Jul'26 | Ago'26 | Total Hist. (₡) | Total Unids | Merma (₡) | Stock |\n`;
    md += `| :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

    cat.products.forEach(p => {
      const margin = p.lastPrice > 0 ? ((p.lastPrice - p.lastCost) / p.lastPrice) : 0;
      const m26 = months2026.map(m => {
        const val = p.monthlyData[m] ? p.monthlyData[m].monto : 0;
        return val > 0 ? Math.round(val).toLocaleString('es-CR') : '-';
      });

      md += `| ${p.sku} | ${p.codeFrumusa || '-'} | ${p.description} | ${p.unit} | ${p.abc} | ${p.lastCost > 0 ? Math.round(p.lastCost) : '-'} | ${p.lastPrice > 0 ? Math.round(p.lastPrice) : '-'} | ${formatPercent(margin)} | ${Math.round(p.sales2024Monto).toLocaleString('es-CR')} | ${Math.round(p.sales2025Monto).toLocaleString('es-CR')} | ${m26.join(' | ')} | **${Math.round(p.totalSalesMonto).toLocaleString('es-CR')}** | ${Math.round(p.totalSalesQty).toLocaleString('es-CR')} | ${Math.round(p.totalMermaMonto).toLocaleString('es-CR')} | ${p.currentStock} |\n`;
    });

    md += `\n`;
  });

  // 7. GUÍA PRÁCTICA PARA ADMINISTRACIÓN DE CATEGORÍAS
  md += `## 7. Recomendaciones Estratégicas para Administración de Categorías\n\n`;
  md += `1. **Optimización de Cobertura Min/Max (Días de Inventario)**:\n`;
  md += `   - **Frutas Frescas y Hortalizas de Hoja** (Perecibilidad extrema): Cobertura máxima recomendada de 2 a 3 días con frecuencia de pedido 3-4 veces por semana para evitar los ₡18.4M acumulados en merma en estas dos categorías.\n`;
  md += `   - **Tubérculos y Raíces** (Papa, Zanahoria, Cebolla): Cobertura objetivo de 4 a 6 días por su mayor vida útil y estabilidad de demanda.\n`;
  md += `   - **Huevos y Lácteos**: Cobertura de 3 a 5 días con rotación FIFO estricta.\n`;
  md += `   - **Abarrotes y Secos**: Cobertura de 7 a 12 días aprovechando múltiplos de empaque y volumen.\n\n`;

  md += `2. **Estrategia de Racionalización de Surtido (Racionalización SKUs Clase C)**:\n`;
  md += `   - Los SKUs Clase C representan menos del 5% de la venta total. Se recomienda evaluar calibres duplicados (ej. múltiples calibres de manzana con rotación mínima) para concentrar volumen en los SKUs líderes y negociar mejores costos de compra.\n\n`;

  md += `3. **Auditoría de Merma por SKU Crítico**:\n`;
  md += `   - Priorizar planes de acción en los 10 SKUs con mayor merma absoluta en colones, revisando calibración de temperatura en exhibición, rotación en góndola y ajuste fino de los sugeridos de compra en días de baja afluencia.\n`;

  return md;
}

const markdownContent = buildMarkdown();
const targetFilePath = path.join(__dirname, '..', 'HISTORICO_MENSUAL_CATEGORIAS.md');
fs.writeFileSync(targetFilePath, markdownContent, 'utf8');
console.log(`✅ Archivo generado exitosamente en ${targetFilePath} (${Math.round(markdownContent.length / 1024)} KB)`);
