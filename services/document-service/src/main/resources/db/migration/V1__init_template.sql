CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(24) NOT NULL,
    code CITEXT NOT NULL,
    name VARCHAR(160) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    content TEXT NOT NULL,
    content_format VARCHAR(24) NOT NULL DEFAULT 'HTML',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_document_templates_version UNIQUE (type, code, version),
    CONSTRAINT ck_document_templates_type CHECK (type IN ('TICKET', 'REPORT')),
    CONSTRAINT ck_document_templates_format CHECK (content_format IN ('HTML', 'HANDLEBARS')),
    CONSTRAINT ck_document_templates_version CHECK (version >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_document_templates_active
    ON document_templates (type, code)
    WHERE active = true;

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type VARCHAR(24) NOT NULL,
    owner_id UUID NOT NULL,
    type VARCHAR(24) NOT NULL,
    template_code VARCHAR(80) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    storage_provider VARCHAR(24) NOT NULL DEFAULT 'local',
    storage_uri TEXT,
    content_type VARCHAR(80),
    file_name VARCHAR(180),
    checksum_sha256 CHAR(64),
    size_bytes BIGINT,
    requested_by_user_id UUID,
    correlation_id UUID,
    ticket_number VARCHAR(60),
    passenger_name VARCHAR(240),
    route_name VARCHAR(240),
    generated_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_documents_owner_type UNIQUE (owner_type, owner_id, type),
    CONSTRAINT ck_documents_owner_type CHECK (owner_type IN ('TICKET', 'REPORT')),
    CONSTRAINT ck_documents_type CHECK (type IN ('TICKET', 'REPORT')),
    CONSTRAINT ck_documents_status CHECK (status IN ('PENDING', 'GENERATED', 'FAILED')),
    CONSTRAINT ck_documents_size CHECK (size_bytes IS NULL OR size_bytes >= 0)
);

CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    event_type VARCHAR(120) NOT NULL,
    aggregate_type VARCHAR(80) NOT NULL,
    aggregate_id UUID NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    CONSTRAINT ck_outbox_events_status CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
    CONSTRAINT ck_outbox_events_attempts CHECK (attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents (owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_status_created ON documents (status, created_at);
CREATE INDEX IF NOT EXISTS idx_documents_ticket_number ON documents (ticket_number);
CREATE INDEX IF NOT EXISTS idx_outbox_events_status_created ON outbox_events (status, created_at);
