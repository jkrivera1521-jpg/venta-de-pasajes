-- dispatch_db - initial PostgreSQL model
-- Owner service: dispatch-service

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE terminals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_id integer UNIQUE,
    local_code citext UNIQUE,
    name citext NOT NULL UNIQUE,
    manager_name text,
    address text,
    phone text,
    email citext,
    active boolean NOT NULL DEFAULT true,
    created_by_user_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_terminal_id uuid NOT NULL REFERENCES terminals (id) ON DELETE RESTRICT,
    destination_terminal_id uuid NOT NULL REFERENCES terminals (id) ON DELETE RESTRICT,
    name text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_routes_different_terminals CHECK (origin_terminal_id <> destination_terminal_id),
    UNIQUE (origin_terminal_id, destination_terminal_id)
);

CREATE TABLE bus_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_id integer UNIQUE,
    name citext NOT NULL UNIQUE,
    description text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE seat_layouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name citext NOT NULL UNIQUE,
    seat_count integer NOT NULL CHECK (seat_count > 0),
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE seat_layout_seats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seat_layout_id uuid NOT NULL REFERENCES seat_layouts (id) ON DELETE CASCADE,
    seat_number integer NOT NULL CHECK (seat_number > 0),
    label text,
    row_number integer NOT NULL CHECK (row_number > 0),
    column_number integer NOT NULL CHECK (column_number > 0),
    position text NOT NULL CHECK (position IN ('WINDOW', 'AISLE', 'MIDDLE', 'DRIVER', 'BLOCKED')),
    active boolean NOT NULL DEFAULT true,
    UNIQUE (seat_layout_id, seat_number),
    UNIQUE (seat_layout_id, row_number, column_number)
);

CREATE TABLE buses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_id integer UNIQUE,
    code citext NOT NULL UNIQUE,
    plate citext NOT NULL UNIQUE,
    description text,
    default_destination text,
    bus_type_id uuid NOT NULL REFERENCES bus_types (id) ON DELETE RESTRICT,
    terminal_id uuid NOT NULL REFERENCES terminals (id) ON DELETE RESTRICT,
    seat_layout_id uuid NOT NULL REFERENCES seat_layouts (id) ON DELETE RESTRICT,
    active boolean NOT NULL DEFAULT true,
    created_by_user_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE departures (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_id integer UNIQUE,
    bus_id uuid NOT NULL REFERENCES buses (id) ON DELETE RESTRICT,
    route_id uuid NOT NULL REFERENCES routes (id) ON DELETE RESTRICT,
    departure_at timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'SCHEDULED'
        CHECK (status IN ('SCHEDULED', 'CANCELLED', 'CLOSED', 'DEPARTED')),
    notes text,
    created_by_user_id uuid,
    cancelled_by_user_id uuid,
    cancellation_reason text,
    cancelled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_departures_cancelled_fields CHECK (
        status <> 'CANCELLED'
        OR cancelled_at IS NOT NULL
    )
);

CREATE TABLE outbox_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    event_type text NOT NULL,
    schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
    source_service text NOT NULL DEFAULT 'dispatch-service',
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

CREATE UNIQUE INDEX uq_departures_bus_time_active
    ON departures (bus_id, departure_at)
    WHERE status IN ('SCHEDULED', 'CLOSED');

CREATE INDEX idx_routes_origin_destination ON routes (origin_terminal_id, destination_terminal_id);
CREATE INDEX idx_buses_terminal ON buses (terminal_id);
CREATE INDEX idx_departures_route_time ON departures (route_id, departure_at);
CREATE INDEX idx_departures_status_time ON departures (status, departure_at);
CREATE INDEX idx_outbox_events_pending ON outbox_events (status, next_attempt_at)
    WHERE status IN ('PENDING', 'FAILED');
