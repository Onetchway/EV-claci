-- Phase 2 (Product Engine), Phase 4 (Billing), Phase 5 (Payments) tables.
-- Safe to re-run.

-- Discounts (add-ons/coupons) and credit applied are broken out from
-- subtotal/total so an invoice can show its own breakdown honestly
-- instead of folding everything into one opaque total.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS add_on_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS credit_applied DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);

-- Branding fields super admins can edit from the Organization page (see
-- tenants.service.js's updateBranding). The platform keeps its own copy
-- so the edit form has something to read back and pre-fill on reload --
-- syncing to the tenant's CRM (which is the value actually rendered on
-- the tenant's login page/sidebar) is a separate, best-effort side effect.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url VARCHAR(2000);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS primary_color_hex VARCHAR(10);

-- ============================================================
-- MODULES — a coarser grouping than feature_catalog.category: an
-- explicit, tenant-toggleable entitlement over a whole product area
-- (e.g. "HR"), independent of the individual feature toggles inside it.
-- key intentionally matches feature_catalog.category so every existing
-- feature already belongs to a module with no data migration needed.
-- ============================================================
CREATE TABLE IF NOT EXISTS modules (
    key VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Absence of a row = fall back to modules.is_default_enabled, same
-- pattern as tenant_features.
CREATE TABLE IF NOT EXISTS tenant_modules (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_key VARCHAR(100) NOT NULL REFERENCES modules(key) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    updated_by UUID REFERENCES super_admins(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, module_key)
);

INSERT INTO modules (key, name, description) VALUES
    ('general',    'General',    'Dashboard and team performance'),
    ('sales',      'Sales',      'Leads, quotations, channel partners, loan customers'),
    ('operations', 'Operations', 'Projects, vendors, purchase orders, assets'),
    ('finance',    'Finance',    'Payments, revenue, settlements'),
    ('hr',         'HR',         'Employees, attendance, roster, holidays, leave'),
    ('settings',   'Settings',   'Team, roles, audit log, trash')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- ============================================================
-- ADD-ONS — independent, purchasable extras attached to a tenant on
-- top of their base plan, each contributing its own invoice line item.
-- ============================================================
CREATE TABLE IF NOT EXISTS add_ons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_add_ons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    add_on_id UUID NOT NULL REFERENCES add_ons(id) ON DELETE CASCADE,
    -- Per-tenant negotiated price; NULL = use add_ons.amount as-is.
    amount_override DECIMAL(12,2),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, add_on_id)
);

-- ============================================================
-- COUPONS — a discount code applied to a tenant's future invoices.
-- ============================================================
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
    amount DECIMAL(12,2) NOT NULL,
    -- NULL = applies forever (until unassigned); otherwise this many
    -- invoices after assignment.
    duration_invoices INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    invoices_applied INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CREDITS — a running per-tenant balance (e.g. a goodwill credit, or
-- overpayment) that reduces the next invoice(s) it's applied to.
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    -- Positive = credit added, negative = credit consumed (by an invoice).
    amount DECIMAL(12,2) NOT NULL,
    reason VARCHAR(500),
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    created_by UUID REFERENCES super_admins(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_credits_tenant ON tenant_credits(tenant_id);

-- ============================================================
-- PAYMENTS — one row per gateway payment attempt against an invoice.
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    gateway VARCHAR(30) NOT NULL DEFAULT 'razorpay',
    gateway_order_id VARCHAR(200),
    gateway_payment_id VARCHAR(200),
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(20) NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'paid', 'failed', 'refunded')),
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
