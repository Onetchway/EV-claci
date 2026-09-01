-- Makes tenants.custom_domain unique, for domain-based tenant resolution
-- (see /api/tenants/resolve). Safe to re-run.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenants_custom_domain_key'
    ) THEN
        ALTER TABLE tenants ADD CONSTRAINT tenants_custom_domain_key UNIQUE (custom_domain);
    END IF;
END $$;
