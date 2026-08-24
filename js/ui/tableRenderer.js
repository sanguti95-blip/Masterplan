/**
 * High-Performance MRP Table Renderer with Column Sorting, Inline Editing,
 * Excel-Style Keyboard Navigation & Mass Selection
 */
const TableRenderer = {
  tableBody: null,
  selectedSkus: new Set(),
  sortColumn: 'totalOrderCost',
  sortDirection: 'desc',
  onSortChangeCallback: null,

  init(onSortChange) {
    this.tableBody = document.getElementById('table-body');
    this.onSortChangeCallback = onSortChange;

    const selectAllCheckbox = document.getElementById('chk-select-all');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        this.toggleSelectAll(e.target.checked);
      });
    }

    // Attach Sort Click Handlers on Table Headers
    const sortHeaders = document.querySelectorAll('.mrp-table th.sortable');
    sortHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (this.sortColumn === col) {
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortColumn = col;
          this.sortDirection = (col === 'description' || col === 'codeSku') ? 'asc' : 'desc';
        }
        this.updateSortHeaderStyles();
        if (typeof this.onSortChangeCallback === 'function') {
          this.onSortChangeCallback(this.sortColumn, this.sortDirection);
        }
      });
    });

    this.updateSortHeaderStyles();
  },

  updateSortHeaderStyles() {
    const sortHeaders = document.querySelectorAll('.mrp-table th.sortable');
    sortHeaders.forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.dataset.sort === this.sortColumn) {
        th.classList.add(this.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
      }
    });
  },

  toggleSelectAll(isChecked) {
    this.selectedSkus.clear();
    const checkboxes = document.querySelectorAll('.row-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = isChecked;
      if (isChecked) {
        this.selectedSkus.add(cb.dataset.sku);
      }
    });
    this.updateBatchActionsToolbar();
  },

  updateBatchActionsToolbar() {
    const toolbar = document.getElementById('batch-actions-toolbar');
    const countSpan = document.getElementById('selected-items-count');
    if (!toolbar) return;

    if (this.selectedSkus.size > 0) {
      toolbar.classList.add('visible');
      if (countSpan) countSpan.innerText = `${this.selectedSkus.size} seleccionados`;
    } else {
      toolbar.classList.remove('visible');
    }
  },

  sortItems(items) {
    if (!this.sortColumn || !items) return items;

    const col = this.sortColumn;
    const dir = this.sortDirection === 'asc' ? 1 : -1;

    return [...items].sort((a, b) => {
      let valA = a[col];
      let valB = b[col];

      // Handle nulls and strings
      if (typeof valA === 'string') {
        return valA.localeCompare(valB || '', 'es') * dir;
      }
      valA = valA !== null && valA !== undefined ? Number(valA) : 0;
      valB = valB !== null && valB !== undefined ? Number(valB) : 0;
      return (valA - valB) * dir;
    });
  },

  render(calculatedItems, onUpdateCallback) {
    if (!this.tableBody) this.init();
    if (!this.tableBody) return;

    if (!calculatedItems || calculatedItems.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="15" class="table-empty-state">
            <div class="empty-msg">
              <i class="fa-solid fa-box-open"></i>
              <p>Ningún artículo coincide con los criterios de búsqueda o filtros seleccionados.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const sortedItems = this.sortItems(calculatedItems);

    const rowsHtml = sortedItems.map((item, rowIndex) => {
      const isSelected = this.selectedSkus.has(item.codeSku);
      const isCritical = item.isCritical;
      const hasOverride = item.manualOverride !== null;
      const isOrdered = item.finalQty > 0;

      // Map category to thematic style
      const cat = item.category || 'Otros Perecederos';
      let catClass = 'tag-cat-otros';
      if (cat.includes('Frutas')) catClass = 'tag-cat-frutas';
      else if (cat.includes('Hortalizas')) catClass = 'tag-cat-hortalizas';
      else if (cat.includes('Tubérculos') || cat.includes('Tuberculos')) catClass = 'tag-cat-tuberculos';
      else if (cat.includes('Vegetales')) catClass = 'tag-cat-vegetales';
      else if (cat.includes('Hierbas')) catClass = 'tag-cat-hierbas';

      // Días de Cobertura Dinámicos:
      // Cobertura Previa = (Stock + Tránsito) / VDP
      // Cobertura Final = (Stock + Tránsito + Pedido) / VDP
      const preCoverage = item.vdp > 0 ? (item.projectedStock / item.vdp) : 999;
      const finalCoverage = item.vdp > 0 ? ((item.projectedStock + item.finalQty) / item.vdp) : 999;
      const targetDays = item.daysToCover || 3;

      let coverageBadge = '';
      if (item.vdp <= 0) {
        coverageBadge = '<span class="status-pill pill-neutral" title="Sin ventas registradas en el período">Sin Venta</span>';
      } else if (finalCoverage < targetDays) {
        coverageBadge = `
          <div class="status-pill pill-danger" title="Crítico: Cobertura insuficiente para el tiempo de entrega y seguridad">
            <strong>${finalCoverage.toFixed(1)} d</strong>
          </div>
          <div class="text-dim font-mono" style="font-size: 0.68rem; margin-top: 2px;">
            ${preCoverage.toFixed(1)}d ➔ <span class="text-danger font-bold">${finalCoverage.toFixed(1)}d</span>
          </div>
        `;
      } else if (finalCoverage < (targetDays + 1.5)) {
        coverageBadge = `
          <div class="status-pill pill-warning" title="Cobertura ajustada para el ciclo">
            <strong>${finalCoverage.toFixed(1)} d</strong>
          </div>
          <div class="text-dim font-mono" style="font-size: 0.68rem; margin-top: 2px;">
            ${preCoverage.toFixed(1)}d ➔ <span class="text-amber font-semibold">${finalCoverage.toFixed(1)}d</span>
          </div>
        `;
      } else {
        coverageBadge = `
          <div class="status-pill pill-success" title="Cobertura óptima garantizada">
            <strong>${finalCoverage.toFixed(1)} d</strong>
          </div>
          <div class="text-dim font-mono" style="font-size: 0.68rem; margin-top: 2px;">
            ${preCoverage.toFixed(1)}d ➔ <span class="text-emerald font-semibold">${finalCoverage.toFixed(1)}d</span>
          </div>
        `;
      }

      const hasFrumusa = Boolean(item.codeFrumusa && item.codeFrumusa.trim() && item.codeFrumusa !== item.codeCountry);
      const hasCountry = Boolean(item.codeCountry && item.codeCountry.trim());

      let skuBadgesHtml = '';
      if (hasFrumusa && hasCountry) {
        skuBadgesHtml = `
          <span class="badge-sku-frumusa" title="Código Frumusa (Proveedor)">${item.codeFrumusa}</span>
          <span class="badge-sku-country" title="Código Country (CODISA)">${item.codeCountry}</span>
        `;
      } else if (hasFrumusa) {
        skuBadgesHtml = `<span class="badge-sku-frumusa" title="Código Frumusa (Proveedor)">${item.codeFrumusa}</span>`;
      } else if (hasCountry) {
        skuBadgesHtml = `<span class="badge-sku-country" title="Código Tienda CODISA (Sin código Frumusa)">${item.codeCountry}</span>`;
      } else {
        skuBadgesHtml = `<span class="badge-sku-country">${item.codeSku}</span>`;
      }

      return `
        <tr class="table-row ${isCritical ? 'row-critical' : ''} ${isOrdered ? 'row-ordered' : ''}" data-sku="${item.codeSku}" data-row="${rowIndex}">
          <td class="col-checkbox text-center">
            <input type="checkbox" class="row-checkbox" data-sku="${item.codeSku}" ${isSelected ? 'checked' : ''} aria-label="Seleccionar ${item.description}">
          </td>
          <td class="col-sku font-mono">
            ${skuBadgesHtml}
          </td>
          <td class="col-desc">
            <span class="product-name" title="${item.description}">${item.description}</span>
            <span class="product-category-tag ${catClass}">${cat}</span>
          </td>
          <td class="col-vdp font-mono text-right" title="Venta Diaria Promedio: ${item.vdp.toFixed(2)} und/día">
            ${item.vdp > 0 ? item.vdp.toFixed(2) : '<span class="text-dim">-</span>'}
          </td>
          <td class="col-stock text-right">
            <input type="number" step="any" min="0" class="input-table stock-input font-mono" 
                   data-sku="${item.codeSku}" data-col="stock" data-row="${rowIndex}" value="${item.stockActual || 0}" 
                   aria-label="Stock físico para ${item.description}" title="Existencia física en Bodega 401">
          </td>
          <td class="col-transit text-right font-mono">
            ${item.activeTransit > 0 ? `<span class="badge-transit">${item.activeTransit}</span>` : '<span class="text-dim">-</span>'}
          </td>
          <td class="col-projected font-mono text-right font-semibold">
            <span class="${item.projectedStock <= 0 ? 'text-danger font-bold' : ''}">${AppFormatter.number(item.projectedStock)}</span>
          </td>
          <td class="col-coverage-days text-center font-mono" title="Cobertura Inicial (Stock+Tránsito): ${preCoverage.toFixed(1)} días | Cobertura Total con Pedido: ${finalCoverage.toFixed(1)} días">
            ${coverageBadge}
          </td>
          <td class="col-target-cov text-center font-mono" title="Cobertura Mínima en unidades fijas: ${item.minCoverageUnits} und">
            <strong>${AppFormatter.number(item.minCoverageUnits, 0)}</strong>
          </td>
          <td class="col-multiple text-center font-mono" title="Bulto: Contenido total por Caja/Saco/Empaque (${item.packMultiple} ${item.unit_eq || 'UD'})">
            <span class="font-semibold text-primary">${item.packMultiple}</span>
            <span class="text-dim font-mono" style="font-size: 0.68rem; display: block;">${item.unit_eq || 'UD'}/cja</span>
          </td>
          <td class="col-suggested text-right font-mono">
            ${item.suggestedUnits > 0 ? `
              <div class="sugg-val font-semibold text-emerald">${AppFormatter.number(item.suggestedUnits)} ${item.unit_eq || 'und'}</div>
              <div class="sugg-sub text-muted font-mono" style="font-size: 0.72rem;"><strong>${item.suggestedBoxes}</strong> cjas</div>
            ` : '<span class="text-dim">-</span>'}
          </td>
          <td class="col-final-order text-right">
            <input type="number" step="any" min="0" class="input-table order-input font-mono ${hasOverride ? 'override-active' : (isOrdered ? 'order-highlight' : '')}" 
                   data-sku="${item.codeSku}" data-col="order" data-row="${rowIndex}" placeholder="${item.suggestedUnits}" 
                   value="${hasOverride ? item.manualOverride : (item.suggestedUnits > 0 ? item.suggestedUnits : '')}"
                   aria-label="Pedido autorizado para ${item.description}"
                   title="${hasOverride ? 'Cantidad ajustada manualmente' : 'Sugerido por el sistema'}">
            ${item.finalQty > 0 ? `
              <div class="font-mono text-muted" style="font-size: 0.72rem; text-align: right; margin-top: 2px;">
                <strong>${item.finalBoxes}</strong> cjas/bultos
              </div>
            ` : ''}
          </td>
          <td class="col-total-cost font-mono text-right font-semibold">
            ${item.totalOrderCost > 0 ? `
              <div class="text-primary">${AppFormatter.currency(item.totalOrderCost)}</div>
              <div class="text-dim font-mono" style="font-size: 0.70rem;">@ ${AppFormatter.currency(item.unitCost)}/u</div>
            ` : '<span class="text-dim">-</span>'}
          </td>
          <td class="col-actions text-center">
            <button class="btn-icon btn-view-sku" data-sku="${item.codeSku}" title="Ver ficha técnica" aria-label="Ver detalle de ${item.description}">
              <i class="fa-solid fa-chart-line"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    this.tableBody.innerHTML = rowsHtml;
    this.attachEventListeners(sortedItems, onUpdateCallback);

    // Restore focus to target row on re-render
    if (this.pendingFocus) {
      const { col, row } = this.pendingFocus;
      const target = this.tableBody.querySelector(`.input-table[data-col="${col}"][data-row="${row}"]`);
      if (target) {
        target.focus();
        target.select();
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      this.pendingFocus = null;
    }
  },

  attachEventListeners(calculatedItems, onUpdateCallback) {
    // Row Checkbox Click
    this.tableBody.querySelectorAll('.row-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const sku = e.target.dataset.sku;
        if (e.target.checked) {
          this.selectedSkus.add(sku);
        } else {
          this.selectedSkus.delete(sku);
        }
        this.updateBatchActionsToolbar();
      });
    });

    // Stock Input Change
    this.tableBody.querySelectorAll('.stock-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const sku = e.target.dataset.sku;
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val >= 0) {
          onUpdateCallback('stock', sku, val);
        }
      });
    });

    // Transit Input Change
    this.tableBody.querySelectorAll('.transit-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const sku = e.target.dataset.sku;
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val >= 0) {
          onUpdateCallback('transit', sku, val);
        }
      });
    });

    // Final Order Input Change
    this.tableBody.querySelectorAll('.order-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const sku = e.target.dataset.sku;
        const text = e.target.value.trim();
        const val = text === '' ? null : parseFloat(text);
        onUpdateCallback('override', sku, val);
      });
    });

    // Excel-Style Keyboard Navigation (Enter/ArrowDown to move to next product, ArrowUp to move to previous)
    this.tableBody.querySelectorAll('.input-table').forEach(input => {
      input.addEventListener('keydown', (e) => {
        const currentRow = parseInt(input.dataset.row, 10);
        const currentCol = input.dataset.col; // 'stock', 'transit', 'order'

        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          e.preventDefault();
          const nextRow = currentRow + 1;
          this.pendingFocus = { col: currentCol, row: nextRow };
          
          // Trigger change immediately to apply edit
          input.dispatchEvent(new Event('change'));

          // Also focus next row immediately
          const target = this.tableBody.querySelector(`.input-table[data-col="${currentCol}"][data-row="${nextRow}"]`);
          if (target) {
            target.focus();
            target.select();
            target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevRow = Math.max(0, currentRow - 1);
          this.pendingFocus = { col: currentCol, row: prevRow };

          input.dispatchEvent(new Event('change'));

          const target = this.tableBody.querySelector(`.input-table[data-col="${currentCol}"][data-row="${prevRow}"]`);
          if (target) {
            target.focus();
            target.select();
            target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        } else if ((e.ctrlKey || e.altKey) && e.key === '0') {
          // Power User Shortcut: Zero out current row
          e.preventDefault();
          const orderInput = this.tableBody.querySelector(`.order-input[data-row="${currentRow}"]`);
          if (orderInput) {
            orderInput.value = '0';
            orderInput.dispatchEvent(new Event('change'));
          }
        }
      });
    });

    // SKU Details button
    this.tableBody.querySelectorAll('.btn-view-sku').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sku = btn.dataset.sku;
        const item = calculatedItems.find(i => i.codeSku === sku);
        if (item && window.ModalManager) {
          window.ModalManager.showSkuDetail(item);
        }
      });
    });
  }
};

window.TableRenderer = TableRenderer;
