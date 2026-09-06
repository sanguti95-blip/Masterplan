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
  storeHours: {
    Lunes: { open: '08:00', close: '19:00', hours: 11 },
    Martes: { open: '08:00', close: '19:00', hours: 11 },
    Miercoles: { open: '08:00', close: '19:00', hours: 11 },
    Jueves: { open: '08:00', close: '19:00', hours: 11 },
    Viernes: { open: '08:00', close: '19:00', hours: 11 },
    Sabado: { open: '08:00', close: '19:00', hours: 11 },
    Domingo: { open: '08:00', close: '16:00', hours: 8 }
  },
  weeklyOperatingHours: 74,
  planningMatrix: {
    Lunes: {
      dayName: 'Lunes',
      deliveryDay: 'Jueves',
      coverageDays: 1,
      demandWeight: 0.89,
      coveredDays: ['Jueves'],
      activeTransitDays: ['Jueves'],
      description: 'Cubre venta de Jueves (Demanda estimada: 0.89x VDP)'
    },
    Martes: {
      dayName: 'Martes',
      deliveryDay: 'Viernes',
      coverageDays: 1,
      demandWeight: 0.88,
      coveredDays: ['Viernes'],
      activeTransitDays: ['Lunes'],
      description: 'Cubre venta de Viernes (Demanda estimada: 0.88x VDP)'
    },
    Miercoles: {
      dayName: 'Miércoles',
      deliveryDay: 'Sábado',
      coverageDays: 3,
      demandWeight: 3.55,
      coveredDays: ['Sábado', 'Domingo', 'Lunes'],
      activeTransitDays: ['Lunes', 'Martes'],
      description: 'Cubre venta de Sáb, Dom y Lun (Pico fin de semana: 3.55x VDP)'
    },
    Jueves: {
      dayName: 'Jueves',
      deliveryDay: 'Martes',
      coverageDays: 2,
      demandWeight: 1.84,
      coveredDays: ['Martes', 'Miércoles'],
      activeTransitDays: ['Martes', 'Miercoles'],
      description: 'Cubre venta de Mar y Mié (Valle entre semana: 1.84x VDP)'
    }
  }
};

window.APP_CONFIG = APP_CONFIG;
