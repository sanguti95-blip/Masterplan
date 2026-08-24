/**
 * Client-Side Corporate Excel (.xlsx) Exporter using SheetJS
 * Autor: Milton Sánchez Gutiérrez
 */
const ExcelExporter = {
  exportOrderToXlsx(orderData, filename) {
    if (typeof XLSX === 'undefined') {
      alert('La biblioteca SheetJS no está cargada. Asegúrate de tener conexión a Internet.');
      return false;
    }

    const { executionDay, deliveryDay, items, totalCost, totalUnits, totalBoxes, orderCode } = orderData;
    const now = new Date();

    const wsData = [
      ['CODISA - ORDEN DE COMPRA Y PEDIDO DE REPOSICIÓN A PROVEEDOR (FRUMUSA)'],
      [`Código de Pedido: ${orderCode || 'PED-COD-01'}`, `Fecha de Generación: ${now.toLocaleDateString('es-CR')} ${now.toLocaleTimeString('es-CR')}`],
      [`Día de Pedido: ${executionDay || 'Lunes'}`, `Fecha Estimada de Ingreso a Bodega: ${deliveryDay || 'Jueves'}`],
      [`Tiempo de Entrega (Lead Time): 72 Horas`, `Moneda: Colones Costarricenses (CRC - ₡)`],
      [], // Espacio
      [
        'Código Frumusa (Proveedor)',
        'Código Tienda (CODISA)',
        'Descripción del Artículo',
        'Unidad de Medida',
        'Venta Diaria (VDP)',
        'Stock Físico (Bodega 401)',
        'Pendiente Tránsito (72h)',
        'Disponibilidad Proyectada',
        'Unid por Bulto / Caja',
        'Total Cajas / Bultos Pedidos',
        'Total Unidades / Kilos Pedidos',
        'Costo Unitario (₡)',
        'Inversión Total Pedido (₡)'
      ]
    ];

    let calcTotalUnits = 0;
    let calcTotalBoxes = 0;
    let calcTotalCost = 0;

    const filteredItems = (items || []).filter(item => Number(item.finalQty || item.quantity || 0) > 0);

    filteredItems.forEach(item => {
      const qty = Number(item.finalQty || item.quantity || 0);
      const mult = Number(item.packMultiple || item.multiplo || 1);
      const boxes = Math.ceil(qty / mult);
      const costUnit = Number(item.unitCost || item.cost || 0);
      const itemCost = qty * costUnit;

      const codeFrumusa = (item.codeFrumusa || item.code_frumusa || item.codeSku || '').toString().trim();
      const codeCountry = (item.codeCountry || item.code_country || '').toString().trim();
      const unit = (item.unit_eq || item.unit_fromusa || item.unit || 'UD').toString().trim();

      calcTotalUnits += qty;
      calcTotalBoxes += boxes;
      calcTotalCost += itemCost;

      wsData.push([
        codeFrumusa,
        codeCountry,
        item.description || item.descripcion || '',
        unit,
        Number((item.vdp || 0).toFixed(2)),
        Number(item.stockActual !== undefined ? item.stockActual : item.stock || 0),
        Number(item.activeTransit !== undefined ? item.activeTransit : item.transit || 0),
        Number(item.projectedStock || 0),
        mult,
        boxes,
        qty,
        Number(costUnit.toFixed(2)),
        Number(itemCost.toFixed(2))
      ]);
    });

    // Fila de Totales
    wsData.push([]);
    wsData.push([
      'TOTALES GENERALES',
      '',
      `${filteredItems.length} SKUs con pedido`,
      '',
      '',
      '',
      '',
      '',
      '',
      calcTotalBoxes,
      calcTotalUnits,
      '',
      calcTotalCost
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Ajustar anchos de columnas
    ws['!cols'] = [
      { wch: 18 },
      { wch: 16 },
      { wch: 40 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 20 },
      { wch: 22 },
      { wch: 18 },
      { wch: 22 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Pedido_CODISA');

    const defaultFilename = filename || `Pedido_${executionDay || 'MRP'}_${now.toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, defaultFilename);
    return true;
  }
};

window.ExcelExporter = ExcelExporter;
