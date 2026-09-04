-- BOQ (Bill of Quantities) -- second module ported from nakjm-crm (see
-- crm/src/lib/db/boq.ts), the foundation several later ports (cost rollup,
-- PO/PI auto-generation, several reports) build on. Categories reuse
-- BOQ_CATEGORIES (HT/LT/CIVIL/MEP/CHARGER/OTHER), which already line up
-- with ev_charging's own installs, not just EPC/construction -- so it's
-- marked core there too, not only for epc/construction. Safe to re-run:
-- upserts by key / (category_key, feature_key).

INSERT INTO feature_catalog (key, name, description, category, is_default_enabled) VALUES
    ('boq', 'BOQ', 'Bill of Quantities per project, with revision lineage and typed-name approval sign-off', 'operations', false)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category;

INSERT INTO business_category_features (category_key, feature_key, recommendation)
VALUES
    ('epc', 'boq', 'core'),
    ('construction', 'boq', 'core'),
    ('ev_charging', 'boq', 'optional')
ON CONFLICT (category_key, feature_key) DO UPDATE SET recommendation = EXCLUDED.recommendation;
