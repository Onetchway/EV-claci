-- First of nakjm-crm's EPC-specific modules ported into the shared crm/
-- codebase (see crm/src/lib/db/tenders.ts) -- government/institutional bid
-- tracking, upstream of a lead's own quotation/project once won. Gated
-- behind its own feature key like every other module so a non-EPC tenant
-- never sees it, and marked 'core' for the two business categories that
-- actually run tenders (migration 008 predates this key, so those rows are
-- backfilled here). Safe to re-run: upserts by key / (category_key, feature_key).

INSERT INTO feature_catalog (key, name, description, category, is_default_enabled) VALUES
    ('tenders', 'Tenders', 'Tracking government/institutional bids ahead of and independent from a lead''s own quotation', 'sales', false)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category;

INSERT INTO business_category_features (category_key, feature_key, recommendation)
VALUES
    ('epc', 'tenders', 'core'),
    ('construction', 'tenders', 'core')
ON CONFLICT (category_key, feature_key) DO UPDATE SET recommendation = EXCLUDED.recommendation;
