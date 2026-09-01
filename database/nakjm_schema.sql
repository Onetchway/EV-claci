-- NAKJM EPC — Client, Project, Procurement & Vendor Management
-- PostgreSQL Schema (extends database/schema.sql — same DB, additive module)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS nakjm_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID, -- NULL in standalone/dedicated/isolated deploys; set for "shared" mode, see platform/README.md
    name VARCHAR(255) NOT NULL,
    client_type VARCHAR(30) NOT NULL DEFAULT 'private' CHECK (client_type IN ('oem', 'cpo', 'private', 'government', 'other')),
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    gstin VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VENDORS
-- ============================================================
CREATE TABLE IF NOT EXISTS nakjm_vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID, -- NULL in standalone/dedicated/isolated deploys; set for "shared" mode, see platform/README.md
    name VARCHAR(255) NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'other' CHECK (category IN ('electrical', 'civil', 'cabling', 'transformer', 'ht_works', 'equipment_supply', 'logistics', 'manpower', 'other')),
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    gstin VARCHAR(20),
    bank_account_no VARCHAR(50),
    bank_ifsc VARCHAR(20),
    bank_name VARCHAR(255),
    rating DECIMAL(2,1) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklisted')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TEAM MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS nakjm_team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID, -- NULL in standalone/dedicated/isolated deploys; set for "shared" mode, see platform/README.md
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    designation VARCHAR(100),
    department VARCHAR(30) NOT NULL DEFAULT 'site' CHECK (department IN ('project_management', 'site', 'procurement', 'design', 'finance', 'qc_qa', 'admin')),
    joined_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS nakjm_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID, -- NULL in standalone/dedicated/isolated deploys; set for "shared" mode, see platform/README.md
    project_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    client_id UUID NOT NULL REFERENCES nakjm_clients(id) ON DELETE RESTRICT,
    project_manager_id UUID REFERENCES nakjm_team_members(id) ON DELETE SET NULL,
    project_type VARCHAR(30) NOT NULL DEFAULT 'ev_charging_station' CHECK (project_type IN ('ev_charging_station', 'ht_connection', 'solar', 'substation', 'battery_swap', 'other')),
    site_address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    capacity_kw DECIMAL(10,2),
    status VARCHAR(20) NOT NULL DEFAULT 'lead' CHECK (status IN ('lead', 'quotation', 'approved', 'in_progress', 'on_hold', 'completed', 'cancelled')),
    start_date DATE,
    target_end_date DATE,
    actual_end_date DATE,
    budget_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    contract_value DECIMAL(14,2) NOT NULL DEFAULT 0,
    poc_name VARCHAR(255),
    poc_phone VARCHAR(50),
    poc_email VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project <-> Team (many-to-many, with a project-specific role)
CREATE TABLE IF NOT EXISTS nakjm_project_team (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID, -- NULL in standalone/dedicated/isolated deploys; set for "shared" mode, see platform/README.md
    project_id UUID NOT NULL REFERENCES nakjm_projects(id) ON DELETE CASCADE,
    team_member_id UUID NOT NULL REFERENCES nakjm_team_members(id) ON DELETE CASCADE,
    project_role VARCHAR(100),
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, team_member_id)
);

-- ============================================================
-- QUOTATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS nakjm_quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID, -- NULL in standalone/dedicated/isolated deploys; set for "shared" mode, see platform/README.md
    quotation_no VARCHAR(50) UNIQUE NOT NULL,
    project_id UUID NOT NULL REFERENCES nakjm_projects(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES nakjm_clients(id) ON DELETE RESTRICT,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'negotiation', 'approved', 'rejected', 'expired')),
    quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE,
    subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
    tax_percent DECIMAL(5,2) NOT NULL DEFAULT 18,
    tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    terms TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nakjm_quotation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID, -- NULL in standalone/dedicated/isolated deploys; set for "shared" mode, see platform/README.md
    quotation_id UUID NOT NULL REFERENCES nakjm_quotations(id) ON DELETE CASCADE,
    sr_no INT NOT NULL DEFAULT 1,
    description TEXT NOT NULL,
    unit VARCHAR(30),
    qty DECIMAL(12,2) NOT NULL DEFAULT 0,
    rate DECIMAL(14,2) NOT NULL DEFAULT 0,
    amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    category VARCHAR(50),
    remarks TEXT
);

-- ============================================================
-- BOQ (Bill of Quantities)
-- ============================================================
CREATE TABLE IF NOT EXISTS nakjm_boqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID, -- NULL in standalone/dedicated/isolated deploys; set for "shared" mode, see platform/README.md
    boq_no VARCHAR(50) UNIQUE NOT NULL,
    project_id UUID NOT NULL REFERENCES nakjm_projects(id) ON DELETE CASCADE,
    quotation_id UUID REFERENCES nakjm_quotations(id) ON DELETE SET NULL,
    site_name VARCHAR(255),
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'revised')),
    boq_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nakjm_boq_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID, -- NULL in standalone/dedicated/isolated deploys; set for "shared" mode, see platform/README.md
    boq_id UUID NOT NULL REFERENCES nakjm_boqs(id) ON DELETE CASCADE,
    section VARCHAR(255),
    sr_no INT NOT NULL DEFAULT 1,
    description TEXT NOT NULL,
    make_oem VARCHAR(255),
    unit VARCHAR(30),
    qty DECIMAL(12,2) NOT NULL DEFAULT 0,
    supply_rate DECIMAL(14,2) NOT NULL DEFAULT 0,
    installation_rate DECIMAL(14,2) NOT NULL DEFAULT 0,
    unit_rate DECIMAL(14,2) NOT NULL DEFAULT 0,
    amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    category VARCHAR(30) DEFAULT 'other' CHECK (category IN ('ht', 'lt', 'civil', 'mep', 'charger', 'other')),
    remarks TEXT
);

-- ============================================================
-- PURCHASE ORDERS (to vendors)
-- ============================================================
CREATE TABLE IF NOT EXISTS nakjm_purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID, -- NULL in standalone/dedicated/isolated deploys; set for "shared" mode, see platform/README.md
    po_no VARCHAR(50) UNIQUE NOT NULL,
    project_id UUID NOT NULL REFERENCES nakjm_projects(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES nakjm_vendors(id) ON DELETE RESTRICT,
    po_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'acknowledged', 'partially_delivered', 'completed', 'cancelled')),
    subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    terms TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nakjm_po_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID, -- NULL in standalone/dedicated/isolated deploys; set for "shared" mode, see platform/README.md
    po_id UUID NOT NULL REFERENCES nakjm_purchase_orders(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    unit VARCHAR(30),
    qty DECIMAL(12,2) NOT NULL DEFAULT 0,
    rate DECIMAL(14,2) NOT NULL DEFAULT 0,
    amount DECIMAL(14,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- PROFORMA INVOICES (to clients)
-- ============================================================
CREATE TABLE IF NOT EXISTS nakjm_proforma_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID, -- NULL in standalone/dedicated/isolated deploys; set for "shared" mode, see platform/README.md
    pi_no VARCHAR(50) UNIQUE NOT NULL,
    project_id UUID NOT NULL REFERENCES nakjm_projects(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES nakjm_clients(id) ON DELETE RESTRICT,
    quotation_id UUID REFERENCES nakjm_quotations(id) ON DELETE SET NULL,
    pi_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partially_paid', 'cancelled')),
    milestone VARCHAR(255),
    subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nakjm_pi_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID, -- NULL in standalone/dedicated/isolated deploys; set for "shared" mode, see platform/README.md
    pi_id UUID NOT NULL REFERENCES nakjm_proforma_invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    unit VARCHAR(30),
    qty DECIMAL(12,2) NOT NULL DEFAULT 0,
    rate DECIMAL(14,2) NOT NULL DEFAULT 0,
    amount DECIMAL(14,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- CLIENT PAYMENTS (collection against a project / PI)
-- ============================================================
CREATE TABLE IF NOT EXISTS nakjm_client_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID, -- NULL in standalone/dedicated/isolated deploys; set for "shared" mode, see platform/README.md
    project_id UUID NOT NULL REFERENCES nakjm_projects(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES nakjm_clients(id) ON DELETE RESTRICT,
    pi_id UUID REFERENCES nakjm_proforma_invoices(id) ON DELETE SET NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    mode VARCHAR(20) NOT NULL DEFAULT 'bank_transfer' CHECK (mode IN ('bank_transfer', 'cheque', 'upi', 'cash', 'other')),
    reference_no VARCHAR(100),
    milestone VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VENDOR PAYMENTS (payouts against a PO)
-- ============================================================
CREATE TABLE IF NOT EXISTS nakjm_vendor_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID, -- NULL in standalone/dedicated/isolated deploys; set for "shared" mode, see platform/README.md
    vendor_id UUID NOT NULL REFERENCES nakjm_vendors(id) ON DELETE RESTRICT,
    project_id UUID NOT NULL REFERENCES nakjm_projects(id) ON DELETE CASCADE,
    po_id UUID REFERENCES nakjm_purchase_orders(id) ON DELETE SET NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    mode VARCHAR(20) NOT NULL DEFAULT 'bank_transfer' CHECK (mode IN ('bank_transfer', 'cheque', 'upi', 'cash', 'other')),
    reference_no VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SITE REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS nakjm_site_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID, -- NULL in standalone/dedicated/isolated deploys; set for "shared" mode, see platform/README.md
    project_id UUID NOT NULL REFERENCES nakjm_projects(id) ON DELETE CASCADE,
    reported_by UUID REFERENCES nakjm_team_members(id) ON DELETE SET NULL,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    report_type VARCHAR(20) NOT NULL DEFAULT 'daily' CHECK (report_type IN ('daily', 'weekly', 'milestone', 'issue')),
    progress_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    work_done TEXT,
    issues TEXT,
    manpower_count INT DEFAULT 0,
    weather VARCHAR(100),
    visible_to_client BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_nakjm_projects_client_id     ON nakjm_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_projects_status         ON nakjm_projects(status);
CREATE INDEX IF NOT EXISTS idx_nakjm_project_team_project_id ON nakjm_project_team(project_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_quotations_project_id   ON nakjm_quotations(project_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_boqs_project_id         ON nakjm_boqs(project_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_boq_items_boq_id        ON nakjm_boq_items(boq_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_po_project_id           ON nakjm_purchase_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_po_vendor_id            ON nakjm_purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_pi_project_id           ON nakjm_proforma_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_client_payments_project ON nakjm_client_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_vendor_payments_vendor  ON nakjm_vendor_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_vendor_payments_project ON nakjm_vendor_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_site_reports_project    ON nakjm_site_reports(project_id);

-- Tenant scoping indexes ("shared" deployment mode, see platform/README.md)
CREATE INDEX IF NOT EXISTS idx_nakjm_clients_tenant_id ON nakjm_clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_vendors_tenant_id ON nakjm_vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_team_members_tenant_id ON nakjm_team_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_projects_tenant_id ON nakjm_projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_project_team_tenant_id ON nakjm_project_team(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_quotations_tenant_id ON nakjm_quotations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_quotation_items_tenant_id ON nakjm_quotation_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_boqs_tenant_id ON nakjm_boqs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_boq_items_tenant_id ON nakjm_boq_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_purchase_orders_tenant_id ON nakjm_purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_po_items_tenant_id ON nakjm_po_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_proforma_invoices_tenant_id ON nakjm_proforma_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_pi_items_tenant_id ON nakjm_pi_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_client_payments_tenant_id ON nakjm_client_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_vendor_payments_tenant_id ON nakjm_vendor_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nakjm_site_reports_tenant_id ON nakjm_site_reports(tenant_id);
