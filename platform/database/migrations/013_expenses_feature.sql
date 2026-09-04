-- Expense management & reimbursement (see crm/src/lib/db/expenses.ts):
-- employee-submitted claims (travel by bike/car auto-calculated from a
-- configured per-km rate, hotel/daily-allowance/other), a two-stage
-- manager-then-finance approval, and employee-wise/team-wise monthly
-- reporting. Category 'hr' alongside the rest of HRMS. Safe to re-run:
-- upserts by key.

INSERT INTO feature_catalog (key, name, description, category, is_default_enabled) VALUES
    ('expenses', 'Expenses', 'Employee expense claims, manager + finance approval, and monthly reimbursement reports', 'hr', false)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category;
