/**
 * Modal Dialog Controller for MRP Workflow
 */
const ModalManager = {
  activeModal: null,
  pendingConfirmCallback: null,

  open(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    this.activeModal = modal;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus first interactive button
    const focusable = modal.querySelector('.btn-primary, button:not(.modal-close)');
    if (focusable) focusable.focus();
  },

  close(modalId) {
    const modal = modalId ? document.getElementById(modalId) : this.activeModal;
    if (!modal) return;

    modal.classList.remove('active');
    document.body.style.overflow = '';
    this.activeModal = null;
  },

  init() {
    // Backdrop click close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.close(overlay.id);
        }
      });
    });

    // Close button click
    document.querySelectorAll('.modal-close, [data-close-modal]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = btn.closest('.modal-overlay');
        if (modal) this.close(modal.id);
      });
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModal) {
        this.close(this.activeModal.id);
      }
    });

    // Confirm Approval Submit Button
    const confirmBtn = document.getElementById('btn-modal-confirm-submit');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (typeof this.pendingConfirmCallback === 'function') {
          const cb = this.pendingConfirmCallback;
          this.pendingConfirmCallback = null;
          this.close('modal-confirm-approval');
          cb();
        }
      });
    }
  },

  showSkuDetail(skuItem) {
    const modal = document.getElementById('modal-sku-detail');
    if (!modal) return;

    document.getElementById('modal-sku-code').innerText = skuItem.codeSku;
    document.getElementById('modal-sku-desc').innerText = skuItem.description;
    document.getElementById('modal-sku-category').innerText = skuItem.category || 'General';

    document.getElementById('modal-val-vdp').innerText = `${Number((skuItem.vdp || 0).toFixed(2))} und/día`;
    document.getElementById('modal-val-stock').innerText = `${skuItem.stockActual} und`;
    document.getElementById('modal-val-transit').innerText = `${skuItem.activeTransit} und`;
    document.getElementById('modal-val-projected').innerText = `${skuItem.projectedStock} und`;

    document.getElementById('modal-val-coverage-days').innerText = `${skuItem.daysToCover} días`;
    document.getElementById('modal-val-safety-stock').innerText = `${skuItem.safetyStockDays} días`;
    document.getElementById('modal-val-target-coverage').innerText = `${skuItem.targetCoverageDays} días`;

    document.getElementById('modal-val-multiple').innerText = `${skuItem.packMultiple} und/caja`;
    document.getElementById('modal-val-suggested-boxes').innerText = `${skuItem.suggestedBoxes} cajas`;
    document.getElementById('modal-val-suggested-units').innerText = `${skuItem.suggestedUnits} und`;

    document.getElementById('modal-val-unit-cost').innerText = AppFormatter.currency(skuItem.unitCost);
    document.getElementById('modal-val-unit-price').innerText = AppFormatter.currency(skuItem.unitPrice || skuItem.unitCost * 1.35);
    document.getElementById('modal-val-total-cost').innerText = AppFormatter.currency(skuItem.totalOrderCost);

    this.open('modal-sku-detail');
  },

  showApprovalConfirmation(summary, onConfirm) {
    this.pendingConfirmCallback = onConfirm;

    const elExec = document.getElementById('confirm-exec-day');
    const elDeliv = document.getElementById('confirm-delivery-day');
    const elSku = document.getElementById('confirm-sku-count');
    const elBox = document.getElementById('confirm-box-count');
    const elCost = document.getElementById('confirm-total-cost');
    const elVar = document.getElementById('confirm-variance-text');

    if (elExec) elExec.innerText = summary.executionDay || 'Lunes';
    if (elDeliv) elDeliv.innerText = `${summary.deliveryDay || 'Jueves'} (72h)`;
    if (elSku) elSku.innerText = AppFormatter.number(summary.skuCount || 0);
    if (elBox) elBox.innerText = `${AppFormatter.number(summary.boxCount || 0)} cjas`;
    if (elCost) elCost.innerText = AppFormatter.currency(summary.totalCost || 0);

    if (elVar) {
      const variance = summary.varianceCost || 0;
      if (variance === 0) {
        elVar.innerText = 'Sin varianza (100% apego a algoritmo MRP)';
        elVar.className = 'font-mono font-semibold text-primary';
      } else if (variance > 0) {
        const pct = summary.suggestedCost > 0 ? ((variance / summary.suggestedCost) * 100).toFixed(1) : '100';
        elVar.innerText = `+${AppFormatter.currency(variance)} (+${pct}% sobre sugerido)`;
        elVar.className = 'font-mono font-semibold text-amber';
      } else {
        const pct = summary.suggestedCost > 0 ? ((Math.abs(variance) / summary.suggestedCost) * 100).toFixed(1) : '100';
        elVar.innerText = `-${AppFormatter.currency(Math.abs(variance))} (-${pct}% bajo sugerido)`;
        elVar.className = 'font-mono font-semibold text-primary';
      }
    }

    this.open('modal-confirm-approval');
  }
};

window.ModalManager = ModalManager;
