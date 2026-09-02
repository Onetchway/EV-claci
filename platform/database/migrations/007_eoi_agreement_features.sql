-- Two document-creation actions inside the Leads workflow, granular enough
-- that a super admin might want to allow a tenant to view/manage leads
-- while withholding the ability to actually issue an EOI or a Franchise
-- Agreement (e.g. a trial tenant, or one whose paperwork isn't finalized
-- yet). Both already exist as UI actions gated only by role
-- (lib/permissions.ts's canEdit/canIssueEoi) -- this adds the platform-level
-- toggle alongside that, same 'sales' category as the rest of the lead
-- workflow's features. Safe to re-run: upserts by key.

INSERT INTO feature_catalog (key, name, description, category, is_default_enabled) VALUES
    ('eoi',                'EOI Creation',       'Drafting and issuing a Letter of Intent / EOI on a lead',   'sales', true),
    ('franchise_agreement', 'Agreement Creation', 'Drafting and issuing a Franchise Agreement on a lead',      'sales', true)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category;
