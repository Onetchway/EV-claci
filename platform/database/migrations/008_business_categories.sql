-- Business Category system: a category is a starting *preset* over the
-- existing modules/feature_catalog two-tier system -- not a new dimension
-- of its own. Picking one at tenant creation pre-fills the wizard's
-- feature checkboxes (core = on, optional = off, everything else untouched)
-- and the super admin can still change any of it afterward exactly like
-- today. Safe to re-run: upserts by key.
--
-- Three categories (Education, Healthcare, School) reuse the same generic
-- CRM engine as everyone else -- there is no dedicated
-- student/patient/course/appointment data model in the CRM yet, so their
-- preset maps onto the closest existing proxy (leads as enquiries, clients
-- as students/patients). That's flagged in their own description rather
-- than pretended away; building the real domain objects is separate,
-- future work.

CREATE TABLE IF NOT EXISTS business_categories (
    key VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Which feature_catalog keys this category recommends, and whether that's
-- a "core" (checked by default) or "optional" (shown, unchecked) suggestion.
-- A feature absent from a category's rows here just isn't part of the
-- preset either way -- the super admin can still turn it on manually like
-- any other feature.
CREATE TABLE IF NOT EXISTS business_category_features (
    category_key VARCHAR(50) NOT NULL REFERENCES business_categories(key) ON DELETE CASCADE,
    feature_key VARCHAR(100) NOT NULL REFERENCES feature_catalog(key) ON DELETE CASCADE,
    recommendation VARCHAR(20) NOT NULL CHECK (recommendation IN ('core', 'optional')),
    PRIMARY KEY (category_key, feature_key)
);

-- Which category a tenant was onboarded under -- informational (drives the
-- wizard's initial preset and shows on the org's own page), not itself an
-- entitlement; the tenant_features rows it seeded are what actually govern
-- access, same as any other feature toggle.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_category VARCHAR(50) REFERENCES business_categories(key);

INSERT INTO business_categories (key, name, description, sort_order) VALUES
    ('ev_charging',           'EV Charging / Charging Infrastructure', 'EV charging network operators, installers, and EPC/sales businesses built around charging infrastructure.', 1),
    ('epc',                   'EPC / Engineering & Infrastructure',    'Engineering, procurement and construction contractors running multi-site infrastructure projects.', 2),
    ('real_estate',           'Real Estate / Property',                'Builders, developers and property sales/broking businesses.', 3),
    ('education',             'Education / Coaching',                  'Coaching institutes and training centers. Reuses the generic CRM/documents engine -- dedicated student/course/batch objects are not yet built.', 4),
    ('healthcare',            'Healthcare / Clinic',                   'Small and mid-size clinics. Reuses the generic CRM/documents engine -- dedicated patient/appointment objects are not yet built.', 5),
    ('school',                'School / Institution',                  'Schools and educational institutions. Reuses the generic CRM/documents engine -- dedicated student/class/fee objects are not yet built.', 6),
    ('professional_services', 'Professional Services',                 'Consultants, agencies, architects, CAs, legal and other client-services businesses.', 7),
    ('construction',          'Construction',                          'Civil contractors and construction companies running site-based projects.', 8)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order;

-- Clears any previous run's recommendation rows before reinserting, so
-- re-running this migration after editing the lists below always leaves
-- exactly this set (INSERT-only would just accumulate).
DELETE FROM business_category_features;

INSERT INTO business_category_features (category_key, feature_key, recommendation) VALUES
    -- EV Charging / Charging Infrastructure
    ('ev_charging', 'dashboard',           'core'), ('ev_charging', 'leads',              'core'),
    ('ev_charging', 'quotations',          'core'), ('ev_charging', 'charger_catalogue',  'core'),
    ('ev_charging', 'projects',            'core'), ('ev_charging', 'stations',           'core'),
    ('ev_charging', 'chargers',            'core'), ('ev_charging', 'vendors',            'core'),
    ('ev_charging', 'purchase_orders',     'core'), ('ev_charging', 'documents',          'core'),
    ('ev_charging', 'employees',           'core'), ('ev_charging', 'attendance',         'core'),
    ('ev_charging', 'users',               'core'), ('ev_charging', 'eoi',                'core'),
    ('ev_charging', 'franchise_agreement', 'core'),
    ('ev_charging', 'bss',                 'optional'), ('ev_charging', 'sessions',           'optional'),
    ('ev_charging', 'franchises',          'optional'), ('ev_charging', 'assets',             'optional'),
    ('ev_charging', 'site_reports',        'optional'), ('ev_charging', 'roster',             'optional'),
    ('ev_charging', 'holidays',            'optional'), ('ev_charging', 'leave_requests',     'optional'),
    ('ev_charging', 'proforma_invoices',   'optional'), ('ev_charging', 'revenue',            'optional'),
    ('ev_charging', 'settlements',         'optional'), ('ev_charging', 'payments',           'optional'),
    ('ev_charging', 'team_performance',    'optional'), ('ev_charging', 'audit_log',          'optional'),
    ('ev_charging', 'developer_api',       'optional'), ('ev_charging', 'trash',              'optional'),
    ('ev_charging', 'channel_partners',    'optional'), ('ev_charging', 'loan_customers',     'optional'),
    ('ev_charging', 'site_enquiries',      'optional'), ('ev_charging', 'clients',            'optional'),

    -- EPC / Engineering & Infrastructure
    ('epc', 'dashboard',       'core'), ('epc', 'leads',          'core'),
    ('epc', 'quotations',      'core'), ('epc', 'projects',       'core'),
    ('epc', 'vendors',         'core'), ('epc', 'purchase_orders','core'),
    ('epc', 'documents',       'core'), ('epc', 'employees',      'core'),
    ('epc', 'attendance',      'core'), ('epc', 'users',          'core'),
    ('epc', 'site_reports',    'core'),
    ('epc', 'assets',             'optional'), ('epc', 'roster',             'optional'),
    ('epc', 'holidays',           'optional'), ('epc', 'leave_requests',     'optional'),
    ('epc', 'proforma_invoices',  'optional'), ('epc', 'revenue',            'optional'),
    ('epc', 'settlements',        'optional'), ('epc', 'payments',           'optional'),
    ('epc', 'team_performance',   'optional'), ('epc', 'audit_log',          'optional'),
    ('epc', 'developer_api',      'optional'), ('epc', 'trash',              'optional'),
    ('epc', 'clients',            'optional'), ('epc', 'channel_partners',   'optional'),
    ('epc', 'eoi',                'optional'), ('epc', 'franchise_agreement','optional'),

    -- Construction
    ('construction', 'dashboard',       'core'), ('construction', 'leads',          'core'),
    ('construction', 'quotations',      'core'), ('construction', 'projects',       'core'),
    ('construction', 'vendors',         'core'), ('construction', 'purchase_orders','core'),
    ('construction', 'documents',       'core'), ('construction', 'site_reports',   'core'),
    ('construction', 'employees',       'core'), ('construction', 'attendance',     'core'),
    ('construction', 'users',           'core'),
    ('construction', 'assets',           'optional'), ('construction', 'roster',            'optional'),
    ('construction', 'holidays',         'optional'), ('construction', 'leave_requests',    'optional'),
    ('construction', 'proforma_invoices','optional'), ('construction', 'revenue',           'optional'),
    ('construction', 'settlements',      'optional'), ('construction', 'payments',          'optional'),
    ('construction', 'team_performance', 'optional'), ('construction', 'audit_log',         'optional'),
    ('construction', 'trash',            'optional'), ('construction', 'clients',           'optional'),
    ('construction', 'franchise_agreement', 'optional'),

    -- Real Estate / Property
    ('real_estate', 'dashboard',       'core'), ('real_estate', 'leads',          'core'),
    ('real_estate', 'site_enquiries',  'core'), ('real_estate', 'channel_partners','core'),
    ('real_estate', 'quotations',      'core'), ('real_estate', 'projects',       'core'),
    ('real_estate', 'clients',         'core'), ('real_estate', 'documents',      'core'),
    ('real_estate', 'users',           'core'),
    ('real_estate', 'proforma_invoices', 'optional'), ('real_estate', 'revenue',            'optional'),
    ('real_estate', 'payments',          'optional'), ('real_estate', 'settlements',        'optional'),
    ('real_estate', 'employees',         'optional'), ('real_estate', 'attendance',         'optional'),
    ('real_estate', 'team_performance',  'optional'), ('real_estate', 'audit_log',          'optional'),
    ('real_estate', 'trash',             'optional'), ('real_estate', 'franchise_agreement','optional'),
    ('real_estate', 'eoi',               'optional'),

    -- Education / Coaching (generic engine -- leads=enquiries, clients=students proxy)
    ('education', 'dashboard',  'core'), ('education', 'leads',          'core'),
    ('education', 'site_enquiries', 'core'), ('education', 'clients',    'core'),
    ('education', 'quotations', 'core'), ('education', 'documents',     'core'),
    ('education', 'employees',  'core'), ('education', 'attendance',    'core'),
    ('education', 'users',      'core'),
    ('education', 'revenue',          'optional'), ('education', 'payments',         'optional'),
    ('education', 'team_performance', 'optional'), ('education', 'audit_log',        'optional'),
    ('education', 'trash',            'optional'), ('education', 'holidays',         'optional'),
    ('education', 'leave_requests',   'optional'), ('education', 'roster',           'optional'),

    -- Healthcare / Clinic (generic engine -- leads=enquiries, clients=patients proxy)
    ('healthcare', 'dashboard', 'core'), ('healthcare', 'leads',      'core'),
    ('healthcare', 'clients',   'core'), ('healthcare', 'documents', 'core'),
    ('healthcare', 'employees', 'core'), ('healthcare', 'attendance','core'),
    ('healthcare', 'users',     'core'), ('healthcare', 'payments',  'core'),
    ('healthcare', 'revenue',          'optional'), ('healthcare', 'settlements',     'optional'),
    ('healthcare', 'team_performance', 'optional'), ('healthcare', 'audit_log',       'optional'),
    ('healthcare', 'trash',            'optional'), ('healthcare', 'holidays',        'optional'),
    ('healthcare', 'leave_requests',   'optional'), ('healthcare', 'roster',          'optional'),

    -- School / Institution (generic engine -- leads=admission enquiries, clients=students proxy)
    ('school', 'dashboard', 'core'), ('school', 'leads',      'core'),
    ('school', 'clients',   'core'), ('school', 'documents', 'core'),
    ('school', 'employees', 'core'), ('school', 'attendance','core'),
    ('school', 'users',     'core'),
    ('school', 'revenue',          'optional'), ('school', 'payments',         'optional'),
    ('school', 'team_performance', 'optional'), ('school', 'audit_log',        'optional'),
    ('school', 'trash',            'optional'), ('school', 'holidays',         'optional'),
    ('school', 'leave_requests',   'optional'), ('school', 'roster',           'optional'),

    -- Professional Services
    ('professional_services', 'dashboard',  'core'), ('professional_services', 'leads',     'core'),
    ('professional_services', 'quotations', 'core'), ('professional_services', 'projects',  'core'),
    ('professional_services', 'clients',    'core'), ('professional_services', 'documents', 'core'),
    ('professional_services', 'employees',  'core'), ('professional_services', 'users',     'core'),
    ('professional_services', 'attendance',       'optional'), ('professional_services', 'revenue',         'optional'),
    ('professional_services', 'payments',         'optional'), ('professional_services', 'settlements',     'optional'),
    ('professional_services', 'proforma_invoices','optional'), ('professional_services', 'team_performance','optional'),
    ('professional_services', 'audit_log',        'optional'), ('professional_services', 'trash',           'optional'),
    ('professional_services', 'purchase_orders',  'optional'), ('professional_services', 'vendors',          'optional'),
    ('professional_services', 'channel_partners', 'optional');
