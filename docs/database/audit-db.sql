-- audit_db - initial PostgreSQL model
-- Owner service: audit-service

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_service text NOT NULL,
    source_event_id uuid NOT NULL,
    event_type text NOT NULL,
    schema_version integer NOT NULL CHECK (schema_version >= 1),
    occurred_at timestamptz NOT NULL,
    ingested_at timestamptz NOT NULL DEFAULT now(),
    correlation_id uuid NOT NULL,
    causation_id uuid,
    actor_user_id uuid,
    action text NOT NULL,
    resource_type text,
    resource_id text,
    idempotency_key text,
    payload jsonb NOT NULL,
    raw_event jsonb NOT NULL,
    UNIQUE (source_service, source_event_id)
);

CREATE TABLE processed_events (
    id bigserial PRIMARY KEY,
    source_service text NOT NULL,
    event_id uuid NOT NULL,
    event_type text NOT NULL,
    schema_version integer NOT NULL CHECK (schema_version >= 1),
    consumer_name text NOT NULL DEFAULT 'audit-service',
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
    source_service text NOT NULL DEFAULT 'audit-service',
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

CREATE INDEX idx_audit_events_occurred_at ON audit_events (occurred_at DESC);
CREATE INDEX idx_audit_events_actor_time ON audit_events (actor_user_id, occurred_at DESC);
CREATE INDEX idx_audit_events_resource ON audit_events (resource_type, resource_id);
CREATE INDEX idx_audit_events_correlation ON audit_events (correlation_id);
CREATE INDEX idx_processed_events_lookup ON processed_events (source_service, event_id);
CREATE INDEX idx_outbox_events_pending ON outbox_events (status, next_attempt_at)
    WHERE status IN ('PENDING', 'FAILED');
