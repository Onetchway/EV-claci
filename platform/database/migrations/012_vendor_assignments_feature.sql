-- Vendor Assignments -- a scope of work handed to a vendor or one of its
-- own sub-vendors, for a project or sub-project (see
-- crm/src/lib/db/vendor-assignments.ts): milestones, payment terms,
-- penalty clause, timeline, and optional links to the Quotation/PO/PI/BOQ
-- that actually bills/procures it. 'operations' category, same as vendors
-- and purchase orders it sits alongside. Safe to re-run: upserts by key /
-- (category_key, feature_key).

INSERT INTO feature_catalog (key, name, description, category, is_default_enabled) VALUES
    ('vendor_assignments', 'Vendor Assignments', 'Work packages assigned to a vendor or sub-vendor, with milestones, payment terms, penalty clause and timeline', 'operations', false)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category;

INSERT INTO business_category_features (category_key, feature_key, recommendation)
VALUES
    ('epc', 'vendor_assignments', 'core'),
    ('construction', 'vendor_assignments', 'core'),
    ('ev_charging', 'vendor_assignments', 'optional')
ON CONFLICT (category_key, feature_key) DO UPDATE SET recommendation = EXCLUDED.recommendation;
