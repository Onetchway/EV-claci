-- Phase 6 (Operations): job run tracking, in-app notifications, and
-- audited support sessions. Safe to re-run.

-- ============================================================
-- JOB RUNS — one row per execution of a scheduled/background job, so the
-- Jobs page has real "last run / status / error" data instead of only
-- what's in the process's own stdout.
-- ============================================================
CREATE TABLE IF NOT EXISTS job_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
    trigger VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (trigger IN ('scheduled', 'manual')),
    result_summary JSONB,
    error TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job_name ON job_runs(job_name, started_at DESC);

-- ============================================================
-- NOTIFICATIONS — in-app feed for the events section 46 lists (new
-- tenant, payment received/failed, trial ending, provisioning failure,
-- etc). Email delivery for the same events reuses email.service.js
-- directly at the call site; this table is just the in-app read/unread
-- feed shown in the console header.
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read, created_at DESC);

-- ============================================================
-- SUPPORT SESSIONS — a super admin's temporary, reason-and-duration-bound
-- access into a tenant's environment (spec section 43). This platform has
-- no live tenant-impersonation surface yet, so a session here is a
-- deliberately-logged grant/intent, not itself an auth mechanism -- but it
-- gives Support Center something real to show and fully audits the access.
-- ============================================================
CREATE TABLE IF NOT EXISTS support_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    super_admin_id UUID REFERENCES super_admins(id) ON DELETE SET NULL,
    reason VARCHAR(500) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_sessions_tenant ON support_sessions(tenant_id, started_at DESC);
