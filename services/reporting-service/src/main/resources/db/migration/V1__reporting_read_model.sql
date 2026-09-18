CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS dim_users (
    user_id UUID PRIMARY KEY,
    legacy_id INTEGER,
    login CITEXT,
    display_name TEXT NOT NULL,
    status TEXT,
    last_event_id UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dim_terminals (
    terminal_id UUID PRIMARY KEY,
    legacy_id INTEGER,
    local_code TEXT,
    name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    last_event_id UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dim_routes (
    route_id UUID PRIMARY KEY,
    origin_terminal_id UUID,
    origin_name TEXT,
    destination_terminal_id UUID,
    destination_name TEXT,
    name TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    last_event_id UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dim_buses (
    bus_id UUID PRIMARY KEY,
    legacy_id INTEGER,
    code TEXT NOT NULL,
    plate TEXT,
    bus_type_id UUID,
    bus_type_name TEXT,
    terminal_id UUID,
    terminal_name TEXT,
    seat_layout_id UUID,
    total_seats INTEGER,
    active BOOLEAN NOT NULL DEFAULT true,
    last_event_id UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dim_departures (
    departure_id UUID PRIMARY KEY,
    legacy_id INTEGER,
    bus_id UUID,
    bus_code TEXT,
    route_id UUID,
    origin_terminal_id UUID,
    origin_name TEXT,
    destination_terminal_id UUID,
    destination_name TEXT,
    departure_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL,
    total_seats INTEGER,
    last_event_id UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fact_ticket_sales (
    ticket_id UUID PRIMARY KEY,
    legacy_id INTEGER,
    ticket_number TEXT NOT NULL,
    departure_id UUID NOT NULL,
    route_id UUID,
    origin_terminal_id UUID,
    destination_terminal_id UUID,
    passenger_id UUID,
    passenger_name TEXT,
    passenger_document_type TEXT,
    passenger_document_number TEXT,
    seat_number INTEGER,
    seat_position TEXT,
    price NUMERIC(12, 2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    payment_method TEXT,
    status TEXT NOT NULL CHECK (status IN ('SOLD', 'CANCELLED')),
    sold_at TIMESTAMPTZ NOT NULL,
    sold_by_user_id UUID,
    seller_display_name TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by_user_id UUID,
    cancellation_reason TEXT,
    refund_amount NUMERIC(12, 2),
    bus_code TEXT,
    bus_type TEXT,
    origin TEXT,
    destination TEXT,
    departure_at TIMESTAMPTZ,
    last_event_id UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fact_documents (
    document_id UUID PRIMARY KEY,
    owner_type TEXT NOT NULL,
    owner_id UUID NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    storage_uri TEXT,
    generated_at TIMESTAMPTZ,
    last_event_id UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report TEXT NOT NULL CHECK (report IN ('SALES', 'PASSENGERS', 'SALES_BY_USER', 'SALES_BY_BUS')),
    format TEXT NOT NULL CHECK (format IN ('CSV', 'PDF')),
    filters JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    document_id UUID,
    requested_by_user_id UUID,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    failure_reason TEXT
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    operation TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    response_status INTEGER,
    response_body JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS processed_events (
    id BIGSERIAL PRIMARY KEY,
    source_service TEXT NOT NULL,
    event_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
    consumer_name TEXT NOT NULL,
    correlation_id UUID,
    status TEXT NOT NULL DEFAULT 'PROCESSED' CHECK (status IN ('PROCESSED', 'FAILED', 'IGNORED')),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    error TEXT,
    UNIQUE (source_service, event_id, consumer_name)
);

CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
    source_service TEXT NOT NULL DEFAULT 'reporting-service',
    correlation_id UUID NOT NULL,
    causation_id UUID,
    actor_user_id UUID,
    resource_type TEXT,
    resource_id TEXT,
    idempotency_key TEXT,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fact_ticket_sales_sold_at ON fact_ticket_sales (sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_fact_ticket_sales_departure ON fact_ticket_sales (departure_id);
CREATE INDEX IF NOT EXISTS idx_fact_ticket_sales_route_time ON fact_ticket_sales (route_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_fact_ticket_sales_terminal_time
    ON fact_ticket_sales (origin_terminal_id, destination_terminal_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_fact_ticket_sales_seller_time ON fact_ticket_sales (sold_by_user_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_fact_ticket_sales_origin_destination_time
    ON fact_ticket_sales (origin, destination, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_dim_departures_time_status ON dim_departures (departure_at, status);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON fact_documents (owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON report_export_jobs (status, requested_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires ON idempotency_keys (expires_at);
CREATE INDEX IF NOT EXISTS idx_processed_events_lookup ON processed_events (source_service, event_id);
CREATE INDEX IF NOT EXISTS idx_outbox_events_pending ON outbox_events (status, next_attempt_at)
    WHERE status IN ('PENDING', 'FAILED');
