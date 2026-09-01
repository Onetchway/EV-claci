-- ============================================================
-- Adds tenant_id to every table, for "shared" deployment mode
-- (see platform/README.md's deployment_mode table).
--
-- tenant_id is nullable and unindexed-by-default-constraint on purpose:
--   - A standalone deploy (not running under the multi-tenant platform,
--     or running in "dedicated"/"isolated" mode) simply never sets it —
--     every row has tenant_id = NULL and the app behaves exactly as
--     before this migration.
--   - A "shared" mode deploy sets TENANT_ID in its environment (see
--     backend/.env.example) and the app-layer tenant-scoping middleware
--     (backend/src/middleware/tenantScope.js) stamps it onto every
--     write and filters every read. The DB does not enforce tenancy by
--     itself — this migration only adds the column and its indexes.
--
-- Safe to re-run: every statement is guarded.
-- ============================================================

DO $$
DECLARE
    t TEXT;
    tenant_tables TEXT[] := ARRAY[
        -- database/schema.sql (EV charging CRM)
        'franchises', 'users', 'stations', 'assets', 'chargers',
        'bss_stations', 'charging_sessions', 'bss_swaps', 'revenues', 'settlements',
        -- database/nakjm_schema.sql (NAKJM EPC CRM)
        'nakjm_clients', 'nakjm_vendors', 'nakjm_team_members', 'nakjm_projects',
        'nakjm_project_team', 'nakjm_quotations', 'nakjm_quotation_items',
        'nakjm_boqs', 'nakjm_boq_items', 'nakjm_purchase_orders', 'nakjm_po_items',
        'nakjm_proforma_invoices', 'nakjm_pi_items', 'nakjm_client_payments',
        'nakjm_vendor_payments', 'nakjm_site_reports',
        -- database/nakjm_documents_schema.sql
        'nakjm_documents'
    ];
BEGIN
    FOREACH t IN ARRAY tenant_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id UUID', t);
            EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tenant_id ON %I (tenant_id)', t, t);
        END IF;
    END LOOP;
END $$;
