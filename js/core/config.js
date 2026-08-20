/**
 * Global Frontend Configuration & State Constants
 */
const APP_CONFIG = {
  appName: 'CODISA - Plan de Abastecimiento & Pedidos',
  version: '2.0.0',
  apiBaseUrl: window.location.origin,
  currency: 'CRC',
  currencySymbol: '₡',
  locale: 'es-CR',
  defaultExecutionDay: 'Lunes',
  defaultSafetyStockDays: 1,
  defaultLeadTimeHours: 72,
  defaultVdpDays: 60,
  cacheTTL: 5 * 60 * 1000, // 5 minutes in memory/localstorage
  googleAppsScriptUrl: 'https://script.google.com/macros/s/AKfycbxNLOOjTlzp-WLcIiQXpoxw510xMvu3hgXF1Bec8mvhdVR3Kpi8GVN2VcIFZKnAvH21Cg/exec',
  planningMatrix: {
    Lunes: {
      dayName: 'Lunes',
      deliveryDay: 'Jueves',
      coverageDays: 1,
      activeTransitDays: ['Jueves'],
      description: 'Cubre venta de Jueves (1 orden activa: jueves anterior)'
    },
    Martes: {
      dayName: 'Martes',
      deliveryDay: 'Viernes',
      coverageDays: 1,
      activeTransitDays: ['Lunes'],
      description: 'Cubre venta de Viernes (1 orden activa: lunes)'
    },
    Miercoles: {
      dayName: 'Miércoles',
      deliveryDay: 'Sábado',
      coverageDays: 3,
      activeTransitDays: ['Lunes', 'Martes'],
      description: 'Cubre venta de Sáb, Dom y Lun (2 órdenes activas: lunes y martes)'
    },
    Jueves: {
      dayName: 'Jueves',
      deliveryDay: 'Martes',
      coverageDays: 2,
      activeTransitDays: ['Martes', 'Miercoles'],
      description: 'Cubre venta de Mar y Mié (2 órdenes activas: martes y miércoles)'
    }
  }
};

window.APP_CONFIG = APP_CONFIG;
