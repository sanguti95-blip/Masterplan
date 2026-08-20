/**
 * Formatter Utilities using Native Intl.NumberFormat for Costa Rica (CRC ₡)
 */
const AppFormatter = {
  // Format Currency (₡ Colones Costarricenses) with smart integer or decimal display
  currency(amount, decimals = 0) {
    if (amount === null || amount === undefined || isNaN(amount)) return '₡0';
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: 'CRC',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(amount);
  },

  // Format Numeric quantities (units, stock)
  number(num, decimals = 0) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return new Intl.NumberFormat('es-CR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num);
  },

  // Format Box multiples
  boxes(qty, multiple = 1) {
    const mult = Math.max(1, Number(multiple) || 1);
    const boxCount = Math.ceil(qty / mult);
    return `${boxCount} cja${boxCount === 1 ? '' : 's'}`;
  },

  // Format Percentage
  percentage(pct, decimals = 1) {
    if (pct === null || pct === undefined || isNaN(pct)) return '0.0%';
    return `${Number(pct).toFixed(decimals)}%`;
  },

  // Date formatting in Costa Rica locale
  date(dateInput) {
    if (!dateInput) return '-';
    const d = new Date(dateInput);
    return d.toLocaleDateString('es-CR', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
};

window.AppFormatter = AppFormatter;
