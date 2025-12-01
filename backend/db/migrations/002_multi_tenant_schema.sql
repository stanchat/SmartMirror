-- SmartMirror Database Schema
-- Migration 002: Multi-tenant architecture for barbershop SaaS

-- =====================================================
-- CORE TENANT TABLES
-- =====================================================

-- Shops table (the tenant/barbershop)
CREATE TABLE IF NOT EXISTS shops (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'America/Chicago',
    business_hours JSONB DEFAULT '{"mon":{"open":"09:00","close":"18:00"},"tue":{"open":"09:00","close":"18:00"},"wed":{"open":"09:00","close":"18:00"},"thu":{"open":"09:00","close":"18:00"},"fri":{"open":"09:00","close":"18:00"},"sat":{"open":"09:00","close":"17:00"},"sun":null}',
    settings JSONB DEFAULT '{}',
    telegram_bot_token VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    subscription_tier VARCHAR(20) DEFAULT 'basic',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Barbers table (staff members with roles)
CREATE TABLE IF NOT EXISTS barbers (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    pin_code VARCHAR(10),
    face_descriptor JSONB,
    face_image_path VARCHAR(255),
    role VARCHAR(20) NOT NULL DEFAULT 'barber' CHECK (role IN ('admin', 'barber')),
    is_active BOOLEAN DEFAULT true,
    color VARCHAR(7) DEFAULT '#3498db',
    telegram_chat_id BIGINT,
    working_hours JSONB DEFAULT '{"mon":true,"tue":true,"wed":true,"thu":true,"fri":true,"sat":true,"sun":false}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_clock_in TIMESTAMP,
    UNIQUE(shop_id, email),
    UNIQUE(shop_id, pin_code)
);

-- Mirror devices table
CREATE TABLE IF NOT EXISTS mirror_devices (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    device_uid VARCHAR(100) UNIQUE NOT NULL,
    label VARCHAR(100) NOT NULL,
    registration_code VARCHAR(20),
    registration_expires TIMESTAMP,
    device_token_hash VARCHAR(255),
    module_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance')),
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Session tracking for barbers at mirrors
CREATE TABLE IF NOT EXISTS mirror_sessions (
    id SERIAL PRIMARY KEY,
    mirror_id INTEGER NOT NULL REFERENCES mirror_devices(id) ON DELETE CASCADE,
    barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
    clock_in TIMESTAMP NOT NULL DEFAULT NOW(),
    clock_out TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Walk-in queue for customers
CREATE TABLE IF NOT EXISTS walk_in_queue (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    customer_id INTEGER REFERENCES users(id),
    customer_name VARCHAR(100) NOT NULL,
    service_id INTEGER REFERENCES services(id),
    preferred_barber_id INTEGER REFERENCES barbers(id),
    queue_position INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'in_service', 'completed', 'no_show')),
    assigned_barber_id INTEGER REFERENCES barbers(id),
    assigned_mirror_id INTEGER REFERENCES mirror_devices(id),
    check_in_time TIMESTAMP DEFAULT NOW(),
    called_time TIMESTAMP,
    service_start_time TIMESTAMP,
    service_end_time TIMESTAMP,
    notes TEXT
);

-- =====================================================
-- ADD SHOP_ID TO EXISTING TABLES
-- =====================================================

-- Add shop_id to services
ALTER TABLE services ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE;

-- Add shop_id and barber_id to users (customers)
ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE;

-- Add shop_id and barber_id to appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS barber_id INTEGER REFERENCES barbers(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS mirror_id INTEGER REFERENCES mirror_devices(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS is_walk_in BOOLEAN DEFAULT false;

-- Add shop_id and barber_id to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS barber_id INTEGER REFERENCES barbers(id) ON DELETE SET NULL;

-- Add shop_id to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS barber_id INTEGER REFERENCES barbers(id) ON DELETE SET NULL;

-- Add shop_id to recognition_events
ALTER TABLE recognition_events ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE;
ALTER TABLE recognition_events ADD COLUMN IF NOT EXISTS mirror_id INTEGER REFERENCES mirror_devices(id) ON DELETE SET NULL;

-- Add shop_id to budget_targets
ALTER TABLE budget_targets ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE;
ALTER TABLE budget_targets ADD COLUMN IF NOT EXISTS barber_id INTEGER REFERENCES barbers(id) ON DELETE SET NULL;

-- =====================================================
-- INDEXES FOR MULTI-TENANT QUERIES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_barbers_shop ON barbers(shop_id);
CREATE INDEX IF NOT EXISTS idx_barbers_shop_active ON barbers(shop_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mirror_devices_shop ON mirror_devices(shop_id);
CREATE INDEX IF NOT EXISTS idx_mirror_sessions_mirror ON mirror_sessions(mirror_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mirror_sessions_barber ON mirror_sessions(barber_id, is_active);
CREATE INDEX IF NOT EXISTS idx_walk_in_queue_shop ON walk_in_queue(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_services_shop ON services(shop_id);
CREATE INDEX IF NOT EXISTS idx_users_shop ON users(shop_id);
CREATE INDEX IF NOT EXISTS idx_appointments_shop ON appointments(shop_id);
CREATE INDEX IF NOT EXISTS idx_appointments_barber ON appointments(barber_id);
CREATE INDEX IF NOT EXISTS idx_appointments_shop_date ON appointments(shop_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_transactions_shop ON transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_barber ON transactions(barber_id);
CREATE INDEX IF NOT EXISTS idx_messages_shop ON messages(shop_id);
CREATE INDEX IF NOT EXISTS idx_budget_targets_shop ON budget_targets(shop_id);

-- =====================================================
-- CREATE DEFAULT SHOP AND MIGRATE EXISTING DATA
-- =====================================================

-- Create a default shop for existing data
INSERT INTO shops (name, slug, address, timezone)
VALUES ('Demo Barbershop', 'demo', '123 Main Street, Chicago, IL', 'America/Chicago')
ON CONFLICT (slug) DO NOTHING;

-- Create a default admin barber
INSERT INTO barbers (shop_id, name, email, role, pin_code)
SELECT id, 'Shop Admin', 'admin@demo.shop', 'admin', '0000'
FROM shops WHERE slug = 'demo'
ON CONFLICT DO NOTHING;

-- Migrate existing data to default shop
UPDATE services SET shop_id = (SELECT id FROM shops WHERE slug = 'demo') WHERE shop_id IS NULL;
UPDATE users SET shop_id = (SELECT id FROM shops WHERE slug = 'demo') WHERE shop_id IS NULL;
UPDATE appointments SET shop_id = (SELECT id FROM shops WHERE slug = 'demo') WHERE shop_id IS NULL;
UPDATE transactions SET shop_id = (SELECT id FROM shops WHERE slug = 'demo') WHERE shop_id IS NULL;
UPDATE messages SET shop_id = (SELECT id FROM shops WHERE slug = 'demo') WHERE shop_id IS NULL;
UPDATE recognition_events SET shop_id = (SELECT id FROM shops WHERE slug = 'demo') WHERE shop_id IS NULL;
UPDATE budget_targets SET shop_id = (SELECT id FROM shops WHERE slug = 'demo') WHERE shop_id IS NULL;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get next queue position for a shop
CREATE OR REPLACE FUNCTION get_next_queue_position(p_shop_id INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE(
        (SELECT MAX(queue_position) + 1 
         FROM walk_in_queue 
         WHERE shop_id = p_shop_id 
         AND status IN ('waiting', 'called')
         AND DATE(check_in_time) = CURRENT_DATE),
        1
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check if barber is available (clocked in and not servicing)
CREATE OR REPLACE FUNCTION is_barber_available(p_barber_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM mirror_sessions 
        WHERE barber_id = p_barber_id 
        AND is_active = true
        AND NOT EXISTS (
            SELECT 1 FROM walk_in_queue 
            WHERE assigned_barber_id = p_barber_id 
            AND status = 'in_service'
        )
    );
END;
$$ LANGUAGE plpgsql;
