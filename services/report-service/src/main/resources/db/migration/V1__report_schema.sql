CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS report_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    document_type VARCHAR(8) NOT NULL CHECK (document_type IN ('XLSX', 'DOCX')),
    active_version INTEGER,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'DELETED')),
    created_by VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by VARCHAR(160) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS report_template_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES report_template(id),
    version INTEGER NOT NULL CHECK (version > 0),
    file_name VARCHAR(180) NOT NULL,
    content_type VARCHAR(120) NOT NULL,
    file_extension VARCHAR(8) NOT NULL CHECK (file_extension IN ('xlsx', 'docx')),
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    checksum_sha256 CHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
    created_by VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at TIMESTAMPTZ,
    UNIQUE (template_id, version),
    UNIQUE (template_id, checksum_sha256)
);

CREATE TABLE IF NOT EXISTS report_template_blob (
    template_version_id UUID PRIMARY KEY REFERENCES report_template_version(id) ON DELETE CASCADE,
    content BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_template_parameter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_version_id UUID NOT NULL REFERENCES report_template_version(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    path VARCHAR(240) NOT NULL,
    data_type VARCHAR(24) NOT NULL,
    required BOOLEAN NOT NULL DEFAULT false,
    repeated BOOLEAN NOT NULL DEFAULT false,
    collection BOOLEAN NOT NULL DEFAULT false,
    default_value JSONB,
    description TEXT,
    source VARCHAR(16) NOT NULL CHECK (source IN ('EXTRACTED', 'DECLARED', 'OVERRIDDEN')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (template_version_id, path)
);

CREATE TABLE IF NOT EXISTS report_job (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code VARCHAR(80) NOT NULL,
    template_version INTEGER,
    output_format VARCHAR(8) NOT NULL CHECK (output_format IN ('XLSX', 'DOCX', 'PDF')),
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    total_items INTEGER NOT NULL CHECK (total_items >= 0),
    processed_items INTEGER NOT NULL DEFAULT 0 CHECK (processed_items >= 0),
    successful_items INTEGER NOT NULL DEFAULT 0 CHECK (successful_items >= 0),
    failed_items INTEGER NOT NULL DEFAULT 0 CHECK (failed_items >= 0),
    result_storage_key VARCHAR(500),
    zip_file_name VARCHAR(180) NOT NULL,
    error_message TEXT,
    created_by VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS report_job_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES report_job(id) ON DELETE CASCADE,
    item_index INTEGER NOT NULL,
    file_name VARCHAR(180) NOT NULL,
    data JSONB NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    error_message TEXT,
    generated_size BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (job_id, item_index)
);

CREATE TABLE IF NOT EXISTS report_audit_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    action VARCHAR(80) NOT NULL,
    resource_type VARCHAR(80) NOT NULL,
    resource_id VARCHAR(160),
    actor VARCHAR(160) NOT NULL,
    correlation_id UUID NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_template_version_status ON report_template_version (template_id, status);
CREATE INDEX IF NOT EXISTS idx_report_template_parameter_path ON report_template_parameter (template_version_id, path);
CREATE INDEX IF NOT EXISTS idx_report_job_status ON report_job (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_job_expires ON report_job (expires_at);
CREATE INDEX IF NOT EXISTS idx_report_job_item_status ON report_job_item (job_id, status);
CREATE INDEX IF NOT EXISTS idx_report_audit_resource ON report_audit_event (resource_type, resource_id, occurred_at DESC);
