CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_service VARCHAR(120) NOT NULL,
    source_event_id UUID NOT NULL,
    event_type VARCHAR(160) NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
    occurred_at TIMESTAMPTZ NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    correlation_id UUID NOT NULL,
    causation_id UUID,
    actor_user_id UUID,
    action VARCHAR(180) NOT NULL,
    resource_type VARCHAR(120),
    resource_id VARCHAR(160),
    idempotency_key VARCHAR(160),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_event JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT uq_audit_events_source_event UNIQUE (source_service, source_event_id)
);

CREATE TABLE IF NOT EXISTS processed_events (
    id BIGSERIAL PRIMARY KEY,
    source_service VARCHAR(120) NOT NULL,
    event_id UUID NOT NULL,
    event_type VARCHAR(160) NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
    consumer_name VARCHAR(120) NOT NULL DEFAULT 'audit-service',
    correlation_id UUID,
    status VARCHAR(24) NOT NULL DEFAULT 'PROCESSED',
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    error TEXT,
    CONSTRAINT ck_processed_events_status CHECK (status IN ('PROCESSED', 'FAILED', 'IGNORED')),
    CONSTRAINT uq_processed_events_source_event_consumer UNIQUE (source_service, event_id, consumer_name)
);

CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    event_type VARCHAR(160) NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
    source_service VARCHAR(120) NOT NULL DEFAULT 'audit-service',
    correlation_id UUID NOT NULL,
    causation_id UUID,
    actor_user_id UUID,
    resource_type VARCHAR(120),
    resource_id VARCHAR(160),
    idempotency_key VARCHAR(160),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_outbox_events_status CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_audit_events_occurred_at ON audit_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_time ON audit_events (actor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_correlation ON audit_events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events (action);
CREATE INDEX IF NOT EXISTS idx_processed_events_lookup ON processed_events (source_service, event_id);
CREATE INDEX IF NOT EXISTS idx_outbox_events_pending ON outbox_events (status, next_attempt_at)
    WHERE status IN ('PENDING', 'FAILED');
