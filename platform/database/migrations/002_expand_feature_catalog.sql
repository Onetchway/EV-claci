-- Expands feature_catalog to match the full production app nav
-- (app.livantogreen.com), CMS excluded per original scope, and
-- re-categorizes existing keys (e.g. users: admin -> settings) to
-- match. Safe to re-run: upserts by key.

INSERT INTO feature_catalog (key, name, description, category, is_default_enabled) VALUES
    -- general
    ('dashboard',        'Dashboard',                    'Overview dashboard',                       'general',    true),
    ('team_performance', 'Team Performance',              'Agent/team performance tracking',          'general',    true),
    -- sales
    ('leads',            'All Leads',                     'Lead capture and pipeline',                'sales',      true),
    ('loan_customers',   'Loan Customers',                'Financed-customer tracking',               'sales',      true),
    ('site_enquiries',   'Site Enquiries',                'Site visit / survey enquiries',            'sales',      true),
    ('channel_partners', 'Channel Partners',              'Partner/referral management',              'sales',      true),
    ('quotations',       'Quotations & BOQ',              'Quotation and bill-of-quantities',         'sales',      true),
    ('charger_catalogue','Charger Catalogue',             'Charger model/pricing catalogue',          'sales',      true),
    -- operations
    ('stations',         'Stations',                      'Charging station management',              'operations', true),
    ('chargers',         'Chargers',                      'Charger/OCPP device management',           'operations', true),
    ('bss',              'Battery Swap (BSS)',            'Battery swap station management',          'operations', true),
    ('franchises',       'Franchise Management',          'Franchise partner management',             'operations', true),
    ('sessions',         'Charging Sessions',             'Session history and monitoring',           'operations', true),
    ('clients',          'Clients',                       'Client relationship management',           'operations', true),
    ('vendors',          'Vendors',                       'Vendor management',                        'operations', true),
    ('projects',         'Projects',                      'Project management',                       'operations', true),
    ('purchase_orders',  'Purchase Orders',               'PO and proforma invoice management',       'operations', true),
    ('proforma_invoices','Proforma Invoices',             'Proforma invoice management',              'operations', true),
    ('assets',           'Asset Register',                'Company/franchise asset register',         'operations', true),
    ('documents',        'Documents',                     'Document storage per client/project',      'operations', true),
    ('site_reports',     'Site Reports',                  'Progress photos and site reporting',       'operations', true),
    -- finance
    ('revenue',          'Revenue & P&L',                 'Revenue tracking and P&L reporting',       'finance',    true),
    ('settlements',      'Settlements',                   'Franchise revenue settlements',            'finance',    true),
    ('payments',         'Payments',                      'Client and vendor payment tracking',       'finance',    true),
    -- hr
    ('employees',        'Employees',                     'Employee directory',                       'hr',         true),
    ('attendance',       'Attendance',                    'Attendance tracking',                      'hr',         true),
    ('roster',           'Roster',                        'Shift/roster scheduling',                  'hr',         true),
    ('holidays',         'Holidays',                      'Holiday calendar',                         'hr',         true),
    ('leave_requests',   'Leave Management',              'Employee leave requests and approval',     'hr',         true),
    -- settings
    ('users',            'Team & Roles',                  'Team member management and roles',         'settings',   true),
    ('audit_log',        'Audit Log',                     'Change/activity audit trail',              'settings',   true),
    ('developer_api',    'Developer (API & Webhooks)',    'API keys and webhook configuration',       'settings',   true),
    ('trash',            'Trash',                         'Recently deleted records',                 'settings',   true)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category;
