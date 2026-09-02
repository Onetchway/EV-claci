-- Phase 1/3/4 gaps closed: full tenant lifecycle (lead → trial → active →
-- past_due/paused → suspended → cancelled → archived), matching subscription
-- states, and two more Alpha admin roles. Safe to re-run.

-- ============================================================
-- TENANT LIFECYCLE — widen the status enum to the full lifecycle from
-- spec §49/§28. 'lead' is a pre-provisioning stage (interested prospect,
-- not yet a real tenant); 'past_due'/'paused' sit between active and
-- suspended so a super admin can distinguish "invoice unpaid" from
-- "customer asked to pause" from "we cut them off"; 'archived' is the
-- end of the retention period after cancellation -- data kept, tenant
-- fully locked out, eligible for a deliberate manual permanent delete
-- (never automatic).
-- ============================================================
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('lead', 'trial', 'active', 'past_due', 'paused', 'suspended', 'cancelled', 'archived'));

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
-- Retention window before a cancelled tenant is eligible for archival —
-- editable per tenant (e.g. a contractual data-retention commitment),
-- defaults to 30 days.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS retention_days INTEGER NOT NULL DEFAULT 30;
-- Guards the "trial ending soon" notification so the daily job doesn't
-- re-notify every run for the same trial.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ending_notified_at TIMESTAMPTZ;

-- ============================================================
-- ALPHA ROLES — adds "operations" (tenant/support day-to-day, no
-- billing/admin access) and "read_only" (view everything, change
-- nothing) alongside the existing super_admin/billing_ops/support.
-- super_admin remains the one role with the universal bypass (see
-- middleware/role.js) -- these are additive, not a rename, so no
-- existing admin's stored role or live session token is affected.
-- ============================================================
ALTER TABLE super_admins DROP CONSTRAINT IF EXISTS super_admins_role_check;
ALTER TABLE super_admins ADD CONSTRAINT super_admins_role_check
  CHECK (role IN ('super_admin', 'billing_ops', 'support', 'operations', 'read_only'));

-- ============================================================
-- PAYMENT METHODS — a saved, reusable charge target (Razorpay customer +
-- token), so auto-charge has something to charge against instead of
-- only ever opening a fresh Checkout. One tenant can have at most one
-- active saved method at a time; re-saving replaces it.
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    gateway VARCHAR(30) NOT NULL DEFAULT 'razorpay',
    gateway_customer_id VARCHAR(200) NOT NULL,
    gateway_token_id VARCHAR(200) NOT NULL,
    card_last4 VARCHAR(4),
    card_network VARCHAR(30),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, gateway_token_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_payment_methods_tenant ON tenant_payment_methods(tenant_id) WHERE active;

-- Tracks an auto-charge attempt against a saved method, separate from the
-- `payments` table's own Checkout-order rows so "we tried to auto-charge
-- and it failed" is never confused with "the tenant never even started
-- paying".
ALTER TABLE payments ADD COLUMN IF NOT EXISTS auto_charged BOOLEAN NOT NULL DEFAULT false;
