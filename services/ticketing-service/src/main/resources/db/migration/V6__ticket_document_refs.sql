CREATE TABLE IF NOT EXISTS ticket_document_refs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    ticket_number VARCHAR(40) NOT NULL,
    source_event_id UUID NOT NULL,
    document_id UUID,
    document_event_id UUID,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    storage_provider VARCHAR(24),
    storage_uri TEXT,
    download_url TEXT,
    content_type VARCHAR(80),
    file_name VARCHAR(180),
    checksum_sha256 CHAR(64),
    size_bytes BIGINT,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ,
    failure_reason TEXT,
    generated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ticket_document_refs_ticket UNIQUE (ticket_id),
    CONSTRAINT uq_ticket_document_refs_source_event UNIQUE (source_event_id),
    CONSTRAINT ck_ticket_document_refs_status CHECK (status IN ('PENDING', 'GENERATED', 'FAILED')),
    CONSTRAINT ck_ticket_document_refs_attempts CHECK (attempts >= 0),
    CONSTRAINT ck_ticket_document_refs_size CHECK (size_bytes IS NULL OR size_bytes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ticket_document_refs_status_retry
    ON ticket_document_refs (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_ticket_document_refs_document_id
    ON ticket_document_refs (document_id);
