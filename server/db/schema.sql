-- ==========================================================
-- PostgreSQL Schema for Supabase Cloud
-- Master Planning (MRP) Suite CODISA v2.0
-- Autor: Milton Sánchez Gutiérrez
-- ==========================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150),
    role VARCHAR(50) DEFAULT 'planner',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Master Products Catalog
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    code_country VARCHAR(50),
    code_frumusa VARCHAR(50) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    unit_eq VARCHAR(20) DEFAULT 'UD',
    unit_price NUMERIC(14, 2) DEFAULT 0,
    unit_cost NUMERIC(14, 2) DEFAULT 0,
    stock_actual NUMERIC(14, 2) DEFAULT 0,
    transit_qty NUMERIC(14, 2) DEFAULT 0,
    vdp NUMERIC(14, 4) DEFAULT 0, -- Venta Diaria Promedio
    sales_period NUMERIC(14, 2) DEFAULT 0,
    days_period INT DEFAULT 30,
    pack_multiple NUMERIC(14, 2) DEFAULT 1, -- Múltiplo de pedido (empaque)
    safety_stock_days NUMERIC(14, 2) DEFAULT 1, -- Stock de Seguridad
    merma_units NUMERIC(14, 2) DEFAULT 0,
    merma_cost NUMERIC(14, 2) DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_codes ON products (code_frumusa, code_country);

-- 3. Planning Matrix Rules (72h Lead Time)
CREATE TABLE IF NOT EXISTS planning_matrix (
    execution_day VARCHAR(20) PRIMARY KEY, -- Lunes, Martes, Miercoles, Jueves
    delivery_day VARCHAR(20) NOT NULL,    -- Jueves, Viernes, Sabado, Martes
    coverage_days INT NOT NULL,           -- 1, 1, 3, 2
    active_transit_days VARCHAR(100) NOT NULL, -- "Jueves anterior", "Lunes", "Lunes y Martes", "Martes y Miercoles"
    description TEXT
);

INSERT INTO planning_matrix (execution_day, delivery_day, coverage_days, active_transit_days, description)
VALUES 
('Lunes', 'Jueves', 1, 'Jueves anterior', 'Cubre venta de Jueves (1 orden activa: jueves anterior)'),
('Martes', 'Viernes', 1, 'Lunes', 'Cubre venta de Viernes (1 orden activa: lunes)'),
('Miercoles', 'Sabado', 3, 'Lunes y Martes', 'Cubre venta de Sábado, Domingo, Lunes (2 órdenes activas: lunes y martes)'),
('Jueves', 'Martes', 2, 'Martes y Miercoles', 'Cubre venta de Martes y Miércoles (2 órdenes activas: martes y miércoles)')
ON CONFLICT (execution_day) DO UPDATE 
SET delivery_day = EXCLUDED.delivery_day,
    coverage_days = EXCLUDED.coverage_days,
    active_transit_days = EXCLUDED.active_transit_days,
    description = EXCLUDED.description;

-- 4. Approved Orders History
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_code VARCHAR(50) UNIQUE NOT NULL,
    execution_day VARCHAR(20) NOT NULL,
    delivery_day VARCHAR(20) NOT NULL,
    expected_delivery_date DATE,
    status VARCHAR(50) DEFAULT 'EN_TRANSITO', -- 'EN_TRANSITO', 'RECIBIDO', 'CANCELADO'
    total_cost NUMERIC(16, 2) DEFAULT 0,
    total_units NUMERIC(14, 2) DEFAULT 0,
    total_boxes NUMERIC(14, 2) DEFAULT 0,
    total_items INT DEFAULT 0,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    received_at TIMESTAMP WITH TIME ZONE
);

-- 5. Order Line Items
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    code_sku VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    projected_stock NUMERIC(14, 2) DEFAULT 0,
    vdp NUMERIC(14, 4) DEFAULT 0,
    target_coverage_days NUMERIC(14, 2) DEFAULT 0,
    suggested_qty NUMERIC(14, 2) DEFAULT 0,
    final_qty NUMERIC(14, 2) NOT NULL,
    boxes_qty NUMERIC(14, 2) DEFAULT 0,
    pack_multiple NUMERIC(14, 2) DEFAULT 1,
    unit_cost NUMERIC(14, 2) DEFAULT 0,
    total_cost NUMERIC(16, 2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);

-- 6. Synchronization Audit Logs
CREATE TABLE IF NOT EXISTS sync_logs (
    id SERIAL PRIMARY KEY,
    source VARCHAR(100) DEFAULT 'Google Apps Script / Codisa',
    status VARCHAR(50) NOT NULL, -- 'SUCCESS', 'ERROR'
    rows_processed INT DEFAULT 0,
    matched_skus INT DEFAULT 0,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Global Application Settings
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
