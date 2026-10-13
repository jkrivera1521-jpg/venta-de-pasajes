-- ticketing_db - initial PostgreSQL model
-- Owner service: ticketing-service

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE dispatch_departure_snapshots (
    departure_id uuid PRIMARY KEY,
    legacy_departure_id integer UNIQUE,
    bus_id uuid NOT NULL,
    bus_code citext NOT NULL,
    bus_type_id uuid,
    bus_type_name text,
    route_id uuid,
    origin_terminal_id uuid,
    origin_name text NOT NULL,
    destination_terminal_id uuid,
    destination_name text NOT NULL,
    seat_layout_id uuid NOT NULL,
    total_seats integer NOT NULL CHECK (total_seats > 0),
    departure_at timestamptz NOT NULL,
    status text NOT NULL CHECK (status IN ('SCHEDULED', 'CANCELLED', 'CLOSED', 'DEPARTED')),
    last_dispatch_event_id uuid,
    synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE departure_seats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    departure_id uuid NOT NULL REFERENCES dispatch_departure_snapshots (departure_id) ON DELETE CASCADE,
    seat_number integer NOT NULL CHECK (seat_number > 0),
    label text,
    position text NOT NULL CHECK (position IN ('WINDOW', 'AISLE', 'MIDDLE')),
    base_status text NOT NULL DEFAULT 'FREE' CHECK (base_status IN ('FREE', 'BLOCKED')),
    UNIQUE (departure_id, seat_number)
);

CREATE TABLE passengers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_legacy_id integer UNIQUE,
    first_name text NOT NULL,
    last_name text NOT NULL,
    document_type text NOT NULL DEFAULT 'DNI',
    document_number citext NOT NULL,
    phone text,
    email citext,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (document_type, document_number)
);

CREATE TABLE passenger_legacy_mappings (
    passenger_id uuid NOT NULL REFERENCES passengers (id) ON DELETE CASCADE,
    legacy_cliente_id integer NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (passenger_id, legacy_cliente_id)
);

CREATE TABLE seat_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    departure_id uuid NOT NULL REFERENCES dispatch_departure_snapshots (departure_id) ON DELETE RESTRICT,
    seat_number integer NOT NULL CHECK (seat_number > 0),
    status text NOT NULL CHECK (status IN ('RESERVED', 'SOLD', 'EXPIRED', 'RELEASED', 'CANCELLED')),
    held_by_user_id uuid,
    sold_by_user_id uuid,
    reservation_expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_seat_allocations_departure_seat
        FOREIGN KEY (departure_id, seat_number)
        REFERENCES departure_seats (departure_id, seat_number)
        ON DELETE RESTRICT
);

CREATE TABLE reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id uuid NOT NULL UNIQUE REFERENCES seat_allocations (id) ON DELETE RESTRICT,
    departure_id uuid NOT NULL,
    seat_number integer NOT NULL CHECK (seat_number > 0),
    status text NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'EXPIRED', 'RELEASED', 'CONVERTED_TO_TICKET')),
    reserved_by_user_id uuid NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_reservations_departure_seat
        FOREIGN KEY (departure_id, seat_number)
        REFERENCES departure_seats (departure_id, seat_number)
        ON DELETE RESTRICT
);

CREATE TABLE tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_id integer UNIQUE,
    ticket_number text NOT NULL UNIQUE,
    allocation_id uuid NOT NULL UNIQUE REFERENCES seat_allocations (id) ON DELETE RESTRICT,
    reservation_id uuid UNIQUE REFERENCES reservations (id) ON DELETE SET NULL,
    departure_id uuid NOT NULL,
    seat_number integer NOT NULL CHECK (seat_number > 0),
    seat_position text NOT NULL,
    passenger_id uuid NOT NULL REFERENCES passengers (id) ON DELETE RESTRICT,
    price numeric(12, 2) NOT NULL CHECK (price >= 0),
    currency char(3) NOT NULL DEFAULT 'PEN',
    payment_method text NOT NULL DEFAULT 'CASH'
        CHECK (payment_method IN ('CASH', 'CARD', 'TRANSFER', 'OTHER')),
    status text NOT NULL DEFAULT 'SOLD' CHECK (status IN ('SOLD', 'CANCELLED')),
    sold_at timestamptz NOT NULL DEFAULT now(),
    sold_by_user_id uuid NOT NULL,
    cancelled_at timestamptz,
    cancelled_by_user_id uuid,
    cancellation_reason text,
    refund_amount numeric(12, 2) CHECK (refund_amount IS NULL OR refund_amount >= 0),
    departure_snapshot jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_tickets_departure_seat
        FOREIGN KEY (departure_id, seat_number)
        REFERENCES departure_seats (departure_id, seat_number)
        ON DELETE RESTRICT,
    CONSTRAINT ck_tickets_cancelled_fields CHECK (
        status <> 'CANCELLED'
        OR (cancelled_at IS NOT NULL AND cancelled_by_user_id IS NOT NULL AND cancellation_reason IS NOT NULL)
    )
);

CREATE TABLE ticket_document_refs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
    ticket_number text NOT NULL,
    source_event_id uuid NOT NULL,
    document_id uuid,
    document_event_id uuid,
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'GENERATED', 'FAILED')),
    storage_provider text,
    storage_uri text,
    download_url text,
    content_type text,
    file_name text,
    checksum_sha256 char(64),
    size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    last_attempt_at timestamptz,
    next_attempt_at timestamptz,
    failure_reason text,
    generated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (ticket_id),
    UNIQUE (source_event_id)
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
    source_service text NOT NULL DEFAULT 'ticketing-service',
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

CREATE UNIQUE INDEX uq_seat_allocations_active_seat
    ON seat_allocations (departure_id, seat_number)
    WHERE status IN ('RESERVED', 'SOLD');

CREATE INDEX idx_departure_snapshots_route_time ON dispatch_departure_snapshots (route_id, departure_at);
CREATE INDEX idx_departure_seats_departure_status ON departure_seats (departure_id, base_status);
CREATE INDEX idx_passengers_document ON passengers (document_type, document_number);
CREATE INDEX idx_reservations_active_expiry ON reservations (expires_at)
    WHERE status = 'ACTIVE';
CREATE INDEX idx_tickets_departure ON tickets (departure_id);
CREATE INDEX idx_tickets_sold_at ON tickets (sold_at DESC);
CREATE INDEX idx_tickets_seller ON tickets (sold_by_user_id, sold_at DESC);
CREATE INDEX idx_ticket_document_refs_status_retry ON ticket_document_refs (status, next_attempt_at);
CREATE INDEX idx_ticket_document_refs_document_id ON ticket_document_refs (document_id);
CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys (expires_at);
CREATE INDEX idx_processed_events_lookup ON processed_events (source_service, event_id);
CREATE INDEX idx_outbox_events_pending ON outbox_events (status, next_attempt_at)
    WHERE status IN ('PENDING', 'FAILED');
