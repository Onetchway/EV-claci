-- Payroll -- salary profiles + monthly payslip generation (see
-- crm/src/lib/db/payroll.ts). Category 'hr' alongside the rest of HRMS.
-- Off by default: unlike attendance/roster/holidays, a fresh tenant
-- shouldn't suddenly expose salary UI to every role until someone
-- deliberately turns it on. Safe to re-run: upserts by key.

INSERT INTO feature_catalog (key, name, description, category, is_default_enabled) VALUES
    ('payroll', 'Payroll', 'Salary profiles, monthly payslip generation, and each employee''s own payslip history', 'hr', false)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category;
