-- documents_db - initial PostgreSQL model
-- Owner service: document-service

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE document_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL CHECK (type IN ('TICKET', 'REPORT')),
    code citext NOT NULL,
    name text NOT NULL,
    version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
    content text NOT NULL,
    content_format text NOT NULL DEFAULT 'HTML' CHECK (content_format IN ('HTML', 'HANDLEBARS')),
    active boolean NOT NULL DEFAULT true,
    created_by_user_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (type, code, version)
);

CREATE UNIQUE INDEX uq_document_templates_active
    ON document_templates (type, code)
    WHERE active = true;

CREATE TABLE documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type text NOT NULL CHECK (owner_type IN ('TICKET', 'REPORT')),
    owner_id uuid NOT NULL,
    type text NOT NULL CHECK (type IN ('TICKET', 'REPORT')),
    template_id uuid REFERENCES document_templates (id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'GENERATED', 'FAILED')),
    storage_uri text,
    content_type text,
    file_name text,
    checksum_sha256 text,
    requested_by_user_id uuid,
    correlation_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    generated_at timestamptz,
    failure_reason text,
    UNIQUE (owner_type, owner_id, type)
);

CREATE TABLE document_generation_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    attempt_number integer NOT NULL CHECK (attempt_number > 0),
    status text NOT NULL CHECK (status IN ('RUNNING', 'GENERATED', 'FAILED')),
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    failure_reason text,
    UNIQUE (document_id, attempt_number)
);

CREATE TABLE idempotency_keys (
    key text PRIMARY KEY,
    operation text NOT NULL,
    request_hash text NOT NULL,
    resource_type text,
    resource_id text,
    response_status integer,
    response_body jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);

CREATE TABLE processed_events (
    id bigserial PRIMARY KEY,
    source_service text NOT NULL,
    event_id uuid NOT NULL,
    event_type text NOT NULL,
    schema_version integer NOT NULL CHECK (schema_version >= 1),
    consumer_name text NOT NULL,
    correlation_id uuid,
    status text NOT NULL DEFAULT 'PROCESSED' CHECK (status IN ('PROCESSED', 'FAILED', 'IGNORED')),
    processed_at timestamptz NOT NULL DEFAULT now(),
    error text,
    UNIQUE (source_service, event_id, consumer_name)
);

CREATE TABLE outbox_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    event_type text NOT NULL,
    schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
    source_service text NOT NULL DEFAULT 'document-service',
    correlation_id uuid NOT NULL,
    causation_id uuid,
    actor_user_id uuid,
    resource_type text,
    resource_id text,
    idempotency_key text,
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_owner ON documents (owner_type, owner_id);
CREATE INDEX idx_documents_status_created ON documents (status, created_at);
CREATE INDEX idx_generation_attempts_document ON document_generation_attempts (document_id, attempt_number);
CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys (expires_at);
CREATE INDEX idx_processed_events_lookup ON processed_events (source_service, event_id);
CREATE INDEX idx_outbox_events_pending ON outbox_events (status, next_attempt_at)
    WHERE status IN ('PENDING', 'FAILED');
