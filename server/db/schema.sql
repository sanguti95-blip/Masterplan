-- Masterplan MRP 3.0 Enterprise Schema

CREATE TABLE IF NOT EXISTS mrp_skus (
  sku_key VARCHAR(50) PRIMARY KEY,
  code_country VARCHAR(50),
  code_frumusa VARCHAR(50),
  description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Perecederos',
  unit_measure VARCHAR(20) DEFAULT 'UD',
  pack_multiple NUMERIC DEFAULT 1,
  min_coverage_qty NUMERIC DEFAULT 1,
  safety_stock_units NUMERIC DEFAULT 1,
  shelf_life_days INTEGER DEFAULT 14,
  is_active BOOLEAN DEFAULT TRUE,
  unit_cost NUMERIC DEFAULT 0,
  unit_price NUMERIC DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mrp_skus_country ON mrp_skus(code_country);
CREATE INDEX IF NOT EXISTS idx_mrp_skus_frumusa ON mrp_skus(code_frumusa);
CREATE INDEX IF NOT EXISTS idx_mrp_skus_category ON mrp_skus(category);
CREATE INDEX IF NOT EXISTS idx_mrp_skus_active ON mrp_skus(is_active);

CREATE TABLE IF NOT EXISTS mrp_inventory_snapshots (
  id SERIAL PRIMARY KEY,
  sku_key VARCHAR(50) REFERENCES mrp_skus(sku_key) ON DELETE CASCADE,
  warehouse_id VARCHAR(20) DEFAULT '401',
  stock_actual NUMERIC NOT NULL DEFAULT 0,
  sales_period NUMERIC DEFAULT 0,
  sales_60d NUMERIC DEFAULT 0,
  days_in_month_cut INTEGER DEFAULT 19,
  merma_units NUMERIC DEFAULT 0,
  merma_cost NUMERIC DEFAULT 0,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mrp_inv_sku ON mrp_inventory_snapshots(sku_key);
CREATE INDEX IF NOT EXISTS idx_mrp_inv_date ON mrp_inventory_snapshots(recorded_at);

CREATE TABLE IF NOT EXISTS mrp_purchase_orders (
  id VARCHAR(100) PRIMARY KEY,
  order_code VARCHAR(100) NOT NULL UNIQUE,
  order_number VARCHAR(100),
  day VARCHAR(20) NOT NULL,
  execution_day VARCHAR(20) NOT NULL,
  delivery_day VARCHAR(20) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'EN_TRANSITO',
  total_cost NUMERIC NOT NULL DEFAULT 0,
  total_boxes NUMERIC NOT NULL DEFAULT 0,
  total_units NUMERIC NOT NULL DEFAULT 0,
  total_items INTEGER NOT NULL DEFAULT 0,
  created_by VARCHAR(100) DEFAULT 'Milton Sánchez Gutiérrez',
  notes TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mrp_po_status ON mrp_purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_mrp_po_day ON mrp_purchase_orders(execution_day);
CREATE INDEX IF NOT EXISTS idx_mrp_po_created ON mrp_purchase_orders(created_at);

CREATE TABLE IF NOT EXISTS mrp_order_receptions (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(100) REFERENCES mrp_purchase_orders(id) ON DELETE CASCADE,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  received_by VARCHAR(100) DEFAULT 'Bodega Santo Domingo',
  total_boxes_received NUMERIC NOT NULL DEFAULT 0,
  total_units_received NUMERIC NOT NULL DEFAULT 0,
  invoice_variance_cost NUMERIC DEFAULT 0,
  notes TEXT,
  items_received JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_mrp_rec_order ON mrp_order_receptions(order_id);

CREATE TABLE IF NOT EXISTS mrp_audit_logs (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  user_name VARCHAR(100) DEFAULT 'Milton Sánchez',
  changes JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);