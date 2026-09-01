-- ============================================================
-- Platform control-plane schema
--
-- This database belongs ONLY to the super-admin platform. It never
-- stores a tenant's employees, customers, sessions, projects, or any
-- other operational data — that lives in each tenant's own CRM
-- database (see deployment_mode below). The platform only knows:
-- who the tenant is, which features they've bought, how they're
-- billed, and what they've been invoiced.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SUPER ADMINS
-- Operators of the platform itself (you / your team). Not tenant users.
-- ============================================================
CREATE TABLE IF NOT EXISTS super_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'billing_ops', 'support')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BILLING PLANS
-- Reusable pricing templates a tenant can be assigned to.
-- ============================================================
CREATE TABLE IF NOT EXISTS billing_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    billing_model VARCHAR(20) NOT NULL CHECK (billing_model IN ('per_employee', 'fixed_monthly')),
    fixed_monthly_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    per_employee_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    tax_percent DECIMAL(5,2) NOT NULL DEFAULT 18,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TENANTS (clients)
-- deployment_mode decides where the tenant's actual CRM data lives —
-- the platform DB never holds it either way:
--   dedicated -> tenant's own domain + own hosting, fully separate stack
--   isolated  -> shared hosting, but a separate database per tenant
--   shared    -> shared hosting + shared database, rows scoped by tenant_id
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    contact_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    deployment_mode VARCHAR(20) NOT NULL DEFAULT 'shared'
        CHECK (deployment_mode IN ('dedicated', 'isolated', 'shared')),
    -- Domain routing (super-admin managed): `slug` doubles as the tenant's
    -- subdomain, e.g. slug "acme" -> acme.${PLATFORM_BASE_DOMAIN}. A tenant
    -- can additionally (or instead) point their own domain at custom_domain,
    -- e.g. crm.acmecorp.com. See /api/tenants/resolve.
    custom_domain VARCHAR(255) UNIQUE,
    db_connection_ref VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'trial'
        CHECK (status IN ('trial', 'active', 'suspended', 'cancelled')),
    billing_plan_id UUID REFERENCES billing_plans(id) ON DELETE SET NULL,
    billing_model_override VARCHAR(20) CHECK (billing_model_override IN ('per_employee', 'fixed_monthly')),
    fixed_monthly_amount_override DECIMAL(12,2),
    per_employee_amount_override DECIMAL(12,2),
    billing_day SMALLINT NOT NULL DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),
    api_key VARCHAR(100) UNIQUE,
    trial_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FEATURE CATALOG
-- Every togglable feature/module the CRM offers.
-- ============================================================
CREATE TABLE IF NOT EXISTS feature_catalog (
    key VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    is_default_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-tenant feature toggles. Absence of a row = fall back to the
-- catalog's is_default_enabled.
CREATE TABLE IF NOT EXISTS tenant_features (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    feature_key VARCHAR(100) NOT NULL REFERENCES feature_catalog(key) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    updated_by UUID REFERENCES super_admins(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, feature_key)
);

-- ============================================================
-- USAGE — self-reported by each tenant's CRM instance, never queried
-- by the platform. Only an employee COUNT crosses the boundary, not
-- who those employees are.
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_usage_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_month DATE NOT NULL, -- first day of the billing month
    employee_count INTEGER NOT NULL DEFAULT 0,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, period_month)
);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    billing_model VARCHAR(20) NOT NULL CHECK (billing_model IN ('per_employee', 'fixed_monthly')),
    employee_count INTEGER,
    unit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(20) NOT NULL DEFAULT 'issued'
        CHECK (status IN ('draft', 'issued', 'paid', 'overdue', 'void')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description VARCHAR(500) NOT NULL,
    quantity DECIMAL(12,2) NOT NULL DEFAULT 1,
    unit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- AUDIT LOG — every super-admin action against a tenant.
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    super_admin_id UUID REFERENCES super_admins(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_features_tenant ON tenant_features(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_usage_tenant_period ON tenant_usage_snapshots(tenant_id, period_month);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id);

-- ============================================================
-- SEED — the CRM's togglable modules (mirrors backend/frontend's
-- existing feature set, minus anything CMS-related, plus the fuller
-- nav from the production app.livantogreen.com — CMS excluded there
-- too. A key here is togglable even before its module is fully built;
-- see platform/README.md for which are live vs. catalog-only today).
-- ============================================================
INSERT INTO feature_catalog (key, name, description, category, is_default_enabled) VALUES
    -- general
    ('dashboard',        'Dashboard',                    'Overview dashboard',                       'general',    true),
    ('team_performance', 'Team Performance',              'Agent/team performance tracking',          'general',    true),
    -- sales
    ('leads',            'All Leads',                     'Lead capture and pipeline',                'sales',      true),
    ('loan_customers',   'Loan Customers',                'Financed-customer tracking',               'sales',      true),
    ('site_enquiries',   'Site Enquiries',                'Site visit / survey enquiries',            'sales',      true),
    ('channel_partners', 'Channel Partners',              'Partner/referral management',              'sales',      true),
    ('quotations',       'Quotations & BOQ',              'Quotation and bill-of-quantities',         'sales',      true),
    ('charger_catalogue','Charger Catalogue',             'Charger model/pricing catalogue',          'sales',      true),
    -- operations
    ('stations',         'Stations',                      'Charging station management',              'operations', true),
    ('chargers',         'Chargers',                      'Charger/OCPP device management',           'operations', true),
    ('bss',              'Battery Swap (BSS)',            'Battery swap station management',          'operations', true),
    ('franchises',       'Franchise Management',          'Franchise partner management',             'operations', true),
    ('sessions',         'Charging Sessions',             'Session history and monitoring',           'operations', true),
    ('clients',          'Clients',                       'Client relationship management',           'operations', true),
    ('vendors',          'Vendors',                       'Vendor management',                        'operations', true),
    ('projects',         'Projects',                      'Project management',                       'operations', true),
    ('purchase_orders',  'Purchase Orders',               'PO and proforma invoice management',       'operations', true),
    ('proforma_invoices','Proforma Invoices',             'Proforma invoice management',              'operations', true),
    ('assets',           'Asset Register',                'Company/franchise asset register',         'operations', true),
    ('documents',        'Documents',                     'Document storage per client/project',      'operations', true),
    ('site_reports',     'Site Reports',                  'Progress photos and site reporting',       'operations', true),
    -- finance
    ('revenue',          'Revenue & P&L',                 'Revenue tracking and P&L reporting',       'finance',    true),
    ('settlements',      'Settlements',                   'Franchise revenue settlements',            'finance',    true),
    ('payments',         'Payments',                      'Client and vendor payment tracking',       'finance',    true),
    -- hr
    ('employees',        'Employees',                     'Employee directory',                       'hr',         true),
    ('attendance',       'Attendance',                    'Attendance tracking',                      'hr',         true),
    ('roster',           'Roster',                        'Shift/roster scheduling',                  'hr',         true),
    ('holidays',         'Holidays',                      'Holiday calendar',                         'hr',         true),
    ('leave_requests',   'Leave Management',              'Employee leave requests and approval',     'hr',         true),
    -- settings
    ('users',            'Team & Roles',                  'Team member management and roles',         'settings',   true),
    ('audit_log',        'Audit Log',                     'Change/activity audit trail',              'settings',   true),
    ('developer_api',    'Developer (API & Webhooks)',    'API keys and webhook configuration',       'settings',   true),
    ('trash',            'Trash',                         'Recently deleted records',                 'settings',   true)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category;
