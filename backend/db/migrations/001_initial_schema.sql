-- SmartMirror Database Schema
-- Migration 001: Initial schema

-- Services table (managed by barber in admin panel)
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    duration_minutes INTEGER DEFAULT 30,
    price_cents INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Users table (customers with face recognition)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_chat_id BIGINT UNIQUE,
    name VARCHAR(100) NOT NULL,
    face_descriptor JSONB,
    face_image_path VARCHAR(255),
    azure_person_id VARCHAR(100),
    recognition_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    service_id INTEGER REFERENCES services(id),
    client_name VARCHAR(100) NOT NULL,
    appointment_date DATE NOT NULL,
    time_slot VARCHAR(20) NOT NULL,
    start_time TIME,
    barber VARCHAR(100) DEFAULT 'Any',
    booked_via VARCHAR(50) DEFAULT 'telegram',
    booked_by VARCHAR(100),
    status VARCHAR(20) DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Transactions table (budget tracking)
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER REFERENCES appointments(id),
    user_id INTEGER REFERENCES users(id),
    amount_cents INTEGER NOT NULL,
    service_name VARCHAR(100),
    client_name VARCHAR(100),
    payment_method VARCHAR(50) DEFAULT 'cash',
    occurred_at TIMESTAMP DEFAULT NOW()
);

-- Telegram messages table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    chat_id BIGINT,
    sender VARCHAR(100),
    text TEXT NOT NULL,
    is_command BOOLEAN DEFAULT false,
    is_new BOOLEAN DEFAULT true,
    sent_at TIMESTAMP DEFAULT NOW()
);

-- Recognition events log
CREATE TABLE IF NOT EXISTS recognition_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    user_name VARCHAR(100),
    confidence NUMERIC(5,4),
    detected_at TIMESTAMP DEFAULT NOW()
);

-- Budget targets table
CREATE TABLE IF NOT EXISTS budget_targets (
    id SERIAL PRIMARY KEY,
    period VARCHAR(20) NOT NULL,
    goal_cents INTEGER NOT NULL,
    period_start DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_date_slot ON appointments(appointment_date, time_slot);
CREATE INDEX IF NOT EXISTS idx_messages_chat_sent ON messages(chat_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_occurred ON transactions(occurred_at DESC);

-- Insert default services
INSERT INTO services (name, description, duration_minutes, price_cents, is_active) VALUES
    ('Haircut', 'Standard haircut', 30, 3500, true),
    ('Beard Trim', 'Beard shaping and trim', 15, 1500, true),
    ('Color', 'Hair coloring service', 60, 7500, true),
    ('Shave', 'Traditional straight razor shave', 20, 2000, true),
    ('Kids Cut', 'Haircut for children under 12', 20, 2500, true)
ON CONFLICT (name) DO NOTHING;

-- Insert default budget targets
INSERT INTO budget_targets (period, goal_cents, period_start) VALUES
    ('weekly', 200000, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER),
    ('monthly', 800000, DATE_TRUNC('month', CURRENT_DATE)::DATE)
ON CONFLICT DO NOTHING;
