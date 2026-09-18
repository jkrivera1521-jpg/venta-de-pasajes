-- reporting_db - initial PostgreSQL read model
-- Owner service: reporting-service

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE dim_users (
    user_id uuid PRIMARY KEY,
    legacy_id integer,
    login citext,
    display_name text NOT NULL,
    status text,
    last_event_id uuid,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dim_terminals (
    terminal_id uuid PRIMARY KEY,
    legacy_id integer,
    local_code text,
    name text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    last_event_id uuid,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dim_routes (
    route_id uuid PRIMARY KEY,
    origin_terminal_id uuid,
    origin_name text,
    destination_terminal_id uuid,
    destination_name text,
    name text,
    active boolean NOT NULL DEFAULT true,
    last_event_id uuid,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dim_buses (
    bus_id uuid PRIMARY KEY,
    legacy_id integer,
    code text NOT NULL,
    plate text,
    bus_type_id uuid,
    bus_type_name text,
    terminal_id uuid,
    terminal_name text,
    seat_layout_id uuid,
    total_seats integer,
    active boolean NOT NULL DEFAULT true,
    last_event_id uuid,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dim_departures (
    departure_id uuid PRIMARY KEY,
    legacy_id integer,
    bus_id uuid,
    bus_code text,
    route_id uuid,
    origin_terminal_id uuid,
    origin_name text,
    destination_terminal_id uuid,
    destination_name text,
    departure_at timestamptz NOT NULL,
    status text NOT NULL,
    total_seats integer,
    last_event_id uuid,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE fact_ticket_sales (
    ticket_id uuid PRIMARY KEY,
    legacy_id integer,
    ticket_number text NOT NULL,
    departure_id uuid NOT NULL,
    route_id uuid,
    origin_terminal_id uuid,
    destination_terminal_id uuid,
    passenger_id uuid,
    passenger_name text,
    passenger_document_type text,
    passenger_document_number text,
    seat_number integer,
    seat_position text,
    price numeric(12, 2) NOT NULL,
    currency char(3) NOT NULL DEFAULT 'PEN',
    payment_method text,
    status text NOT NULL CHECK (status IN ('SOLD', 'CANCELLED')),
    sold_at timestamptz NOT NULL,
    sold_by_user_id uuid,
    seller_display_name text,
    cancelled_at timestamptz,
    cancelled_by_user_id uuid,
    cancellation_reason text,
    refund_amount numeric(12, 2),
    bus_code text,
    bus_type text,
    origin text,
    destination text,
    departure_at timestamptz,
    last_event_id uuid,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE fact_documents (
    document_id uuid PRIMARY KEY,
    owner_type text NOT NULL,
    owner_id uuid NOT NULL,
    type text NOT NULL,
    status text NOT NULL,
    storage_uri text,
    generated_at timestamptz,
    last_event_id uuid,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE report_export_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report text NOT NULL CHECK (report IN ('SALES', 'PASSENGERS', 'SALES_BY_USER', 'SALES_BY_BUS')),
    format text NOT NULL CHECK (format IN ('CSV', 'PDF')),
    filters jsonb NOT NULL,
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    document_id uuid,
    requested_by_user_id uuid,
    requested_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    failure_reason text
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
    source_service text NOT NULL DEFAULT 'reporting-service',
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

CREATE INDEX idx_fact_ticket_sales_sold_at ON fact_ticket_sales (sold_at DESC);
CREATE INDEX idx_fact_ticket_sales_departure ON fact_ticket_sales (departure_id);
CREATE INDEX idx_fact_ticket_sales_route_time ON fact_ticket_sales (route_id, sold_at DESC);
CREATE INDEX idx_fact_ticket_sales_terminal_time
    ON fact_ticket_sales (origin_terminal_id, destination_terminal_id, sold_at DESC);
CREATE INDEX idx_fact_ticket_sales_seller_time ON fact_ticket_sales (sold_by_user_id, sold_at DESC);
CREATE INDEX idx_fact_ticket_sales_origin_destination_time
    ON fact_ticket_sales (origin, destination, sold_at DESC);
CREATE INDEX idx_dim_departures_time_status ON dim_departures (departure_at, status);
CREATE INDEX idx_documents_owner ON fact_documents (owner_type, owner_id);
CREATE INDEX idx_export_jobs_status ON report_export_jobs (status, requested_at);
CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys (expires_at);
CREATE INDEX idx_processed_events_lookup ON processed_events (source_service, event_id);
CREATE INDEX idx_outbox_events_pending ON outbox_events (status, next_attempt_at)
    WHERE status IN ('PENDING', 'FAILED');
