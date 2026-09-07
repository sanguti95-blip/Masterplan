require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 8085,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'mrp_codisa_super_secret_jwt_key_2026_milton',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres.igfwjhuwxsdsjwbsuvxm:Sofias110621sanguti9527@aws-0-ca-central-1.pooler.supabase.com:6543/postgres',
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://igfwjhuwxsdsjwbsuvxm.supabase.co',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  GOOGLE_APPS_SCRIPT_URL: process.env.GOOGLE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxNLOOjTlzp-WLcIiQXpoxw510xMvu3hgXF1Bec8mvhdVR3Kpi8GVN2VcIFZKnAvH21Cg/exec',
  DEFAULT_SAFETY_STOCK_DAYS: Number(process.env.DEFAULT_SAFETY_STOCK_DAYS) || 1,
  DEFAULT_VDP_DAYS: Number(process.env.DEFAULT_VDP_DAYS) || 60,
  DEFAULT_LEAD_TIME_HOURS: 72,
  CURRENCY: 'CRC',
  CURRENCY_SYMBOL: '₡',
  STORE_HOURS: {
    Lunes: { open: '08:00', close: '19:00', hours: 11 },
    Martes: { open: '08:00', close: '19:00', hours: 11 },
    Miercoles: { open: '08:00', close: '19:00', hours: 11 },
    Jueves: { open: '08:00', close: '19:00', hours: 11 },
    Viernes: { open: '08:00', close: '19:00', hours: 11 },
    Sabado: { open: '08:00', close: '19:00', hours: 11 },
    Domingo: { open: '08:00', close: '16:00', hours: 8 }
  },
  WEEKLY_OPERATING_HOURS: 74
};
