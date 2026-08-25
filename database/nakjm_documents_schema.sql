-- NAKJM EPC — Document uploads (client PO/work orders, BOQ source files, etc.)
-- Additive migration — run after nakjm_schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS nakjm_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES nakjm_projects(id) ON DELETE CASCADE,
    doc_type VARCHAR(30) NOT NULL DEFAULT 'other' CHECK (doc_type IN ('client_po', 'work_order', 'boq_upload', 'quotation_upload', 'other')),
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    mime_type VARCHAR(150),
    size_bytes INT,
    notes TEXT,
    uploaded_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nakjm_documents_project_id ON nakjm_documents(project_id);

-- Link a project / PI / BOQ back to the client PO, work order, or BOQ file it was generated from
ALTER TABLE nakjm_projects            ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES nakjm_documents(id) ON DELETE SET NULL;
ALTER TABLE nakjm_proforma_invoices   ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES nakjm_documents(id) ON DELETE SET NULL;
ALTER TABLE nakjm_boqs                ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES nakjm_documents(id) ON DELETE SET NULL;
ALTER TABLE nakjm_quotations          ADD COLUMN IF NOT EXISTS source_boq_id UUID REFERENCES nakjm_boqs(id) ON DELETE SET NULL;
