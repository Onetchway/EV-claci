-- Tracks WHEN each of a tenant's CRM users joined/left, self-reported by
-- that tenant's CRM instance (see crm/scripts/report-usage.ts and
-- platform/backend/src/services/usage.service.js's reportEmployees()) --
-- never pulled by the platform. Deliberately holds no name, email, or any
-- other identifying detail -- external_uid is an opaque per-tenant key
-- (that tenant's own Firebase uid), only ever used to track one person's
-- join/leave dates for prorated per-employee billing (like Google
-- Workspace: a seat added mid-month is billed only for the days it
-- existed, not the whole month) -- see invoices.service.js's
-- computeProratedEmployeeCharge(). The super admin only ever sees the
-- resulting COUNT and prorated total, never this table directly.
--
-- removed_at IS NULL means "currently counted"; set the moment a report
-- stops naming this uid, or names it as active:false. Reappearing simply
-- clears removed_at -- first_seen_at is never reset, so proration always
-- reflects this person's true original join date.
CREATE TABLE IF NOT EXISTS tenant_employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_uid VARCHAR(200) NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    removed_at TIMESTAMPTZ,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, external_uid)
);

CREATE INDEX IF NOT EXISTS idx_tenant_employees_tenant ON tenant_employees(tenant_id);
