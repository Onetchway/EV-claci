-- EV Charging & Infrastructure Management System
-- PostgreSQL Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- FRANCHISES (referenced by users and assets)
-- ============================================================
CREATE TABLE IF NOT EXISTS franchises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    type VARCHAR(50) NOT NULL CHECK (type IN ('land_owner', 'investor', 'operator')),
    revenue_share_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    investment_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    picture VARCHAR(500),
    role VARCHAR(50) NOT NULL DEFAULT 'operations' CHECK (role IN ('admin', 'operations', 'finance', 'franchise')),
    franchise_id UUID REFERENCES franchises(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    station_type VARCHAR(50) NOT NULL CHECK (station_type IN ('public', 'fleet', 'franchise', 'bss_hub')),
    electricity_rate DECIMAL(8,4) NOT NULL DEFAULT 0,
    selling_rate DECIMAL(8,4) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ASSETS
-- ============================================================
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN ('charger', 'bss', 'transformer', 'solar')),
    name VARCHAR(255) NOT NULL,
    capacity VARCHAR(100),
    oem VARCHAR(255),
    installed_by VARCHAR(50) NOT NULL DEFAULT 'company' CHECK (installed_by IN ('company', 'franchise')),
    ownership VARCHAR(50) NOT NULL DEFAULT 'company' CHECK (ownership IN ('company', 'franchise')),
    franchise_id UUID REFERENCES franchises(id) ON DELETE SET NULL,
    commission_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CHARGERS
-- ============================================================
CREATE TABLE IF NOT EXISTS chargers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID UNIQUE REFERENCES assets(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    connector_type VARCHAR(20) NOT NULL CHECK (connector_type IN ('CCS', 'CHAdeMO', 'Type2', 'GB/T')),
    power_rating DECIMAL(8,2) NOT NULL DEFAULT 0,
    ocpp_id VARCHAR(100) UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'charging', 'fault', 'offline')),
    last_heartbeat TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BSS STATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS bss_stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID UNIQUE REFERENCES assets(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    number_of_batteries INT NOT NULL DEFAULT 0,
    battery_type VARCHAR(100),
    swap_price DECIMAL(8,2) NOT NULL DEFAULT 0,
    rental_price_daily DECIMAL(8,2) NOT NULL DEFAULT 0,
    rental_price_monthly DECIMAL(8,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CHARGING SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS charging_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    charger_id UUID NOT NULL REFERENCES chargers(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    user_ref VARCHAR(255),
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    energy_kwh DECIMAL(10,4) NOT NULL DEFAULT 0,
    revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
    electricity_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    margin DECIMAL(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'error')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BSS SWAPS
-- ============================================================
CREATE TABLE IF NOT EXISTS bss_swaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bss_station_id UUID NOT NULL REFERENCES bss_stations(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    swap_type VARCHAR(20) NOT NULL CHECK (swap_type IN ('swap', 'rental_start', 'rental_end')),
    amount DECIMAL(8,2) NOT NULL DEFAULT 0,
    swap_date DATE NOT NULL DEFAULT CURRENT_DATE,
    rental_days INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REVENUES (daily aggregates)
-- ============================================================
CREATE TABLE IF NOT EXISTS revenues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    charging_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
    bss_swap_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
    bss_rental_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
    electricity_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    gross_margin DECIMAL(12,2) NOT NULL DEFAULT 0,
    energy_consumed DECIMAL(12,4) NOT NULL DEFAULT 0,
    session_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(station_id, date)
);

-- ============================================================
-- SETTLEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
    franchise_share DECIMAL(12,2) NOT NULL DEFAULT 0,
    company_share DECIMAL(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_stations_city_state ON stations(city, state);
CREATE INDEX IF NOT EXISTS idx_chargers_station_id ON chargers(station_id);
CREATE INDEX IF NOT EXISTS idx_chargers_status ON chargers(status);
CREATE INDEX IF NOT EXISTS idx_charging_sessions_station_start ON charging_sessions(station_id, start_time);
CREATE INDEX IF NOT EXISTS idx_revenues_station_date ON revenues(station_id, date);
CREATE INDEX IF NOT EXISTS idx_settlements_franchise_status ON settlements(franchise_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_station_id ON assets(station_id);
CREATE INDEX IF NOT EXISTS idx_bss_swaps_station_id ON bss_swaps(bss_station_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_charging_sessions_charger_id ON charging_sessions(charger_id);
