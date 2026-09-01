-- Franchise partner portal: stage tracker, document uploads, payment
-- ledger, refund bank details, and support requests — mirrors the
-- EOI -> Agreement -> Payments -> Site Setup journey the franchise's own
-- login sees at GET /api/franchises/portal/dashboard (and the sibling
-- portal/documents, portal/payments, portal/bank-details, portal/support
-- endpoints — see backend/src/routes/franchise.routes.js).

ALTER TABLE franchises
  ADD COLUMN IF NOT EXISTS stage VARCHAR(30) NOT NULL DEFAULT 'eoi'
    CHECK (stage IN ('eoi', 'agreement', 'payment', 'site_setup', 'active'));

CREATE TABLE IF NOT EXISTS franchise_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
    kind VARCHAR(50) NOT NULL CHECK (kind IN (
        'pan', 'aadhaar', 'gst_certificate', 'cancelled_cheque', 'photograph',
        'electricity_bill', 'load_sanction', 'property_proof', 'lease_agreement', 'site_photo',
        'eoi_form', 'franchise_agreement'
    )),
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100),
    size_bytes INTEGER,
    uploaded_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS franchise_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
    kind VARCHAR(30) NOT NULL DEFAULT 'installment' CHECK (kind IN ('eoi', 'agreement', 'installment')),
    amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
    due_date DATE,
    paid_at TIMESTAMPTZ,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS franchise_bank_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    franchise_id UUID NOT NULL UNIQUE REFERENCES franchises(id) ON DELETE CASCADE,
    account_holder_name VARCHAR(255) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    ifsc VARCHAR(20) NOT NULL,
    branch VARCHAR(255),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS franchise_support_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_franchise_documents_franchise_id ON franchise_documents(franchise_id);
CREATE INDEX IF NOT EXISTS idx_franchise_documents_tenant_id ON franchise_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_franchise_payments_franchise_id ON franchise_payments(franchise_id);
CREATE INDEX IF NOT EXISTS idx_franchise_payments_tenant_id ON franchise_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_franchise_support_requests_franchise_id ON franchise_support_requests(franchise_id);
CREATE INDEX IF NOT EXISTS idx_franchise_support_requests_tenant_id ON franchise_support_requests(tenant_id);
