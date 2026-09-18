CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS passengers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_id INTEGER UNIQUE,
    document_type VARCHAR(24) NOT NULL,
    document_number VARCHAR(64) NOT NULL,
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120) NOT NULL,
    email CITEXT,
    phone VARCHAR(40),
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_passengers_document UNIQUE (document_type, document_number),
    CONSTRAINT ck_passengers_document_type CHECK (document_type IN ('CEDULA', 'PASSPORT', 'RUC', 'OTHER')),
    CONSTRAINT ck_passengers_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_passengers_email_not_null
    ON passengers (email)
    WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_code VARCHAR(40) NOT NULL UNIQUE,
    passenger_id UUID NOT NULL REFERENCES passengers(id),
    dispatch_departure_id UUID NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_reservations_status CHECK (
        status IN ('PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'CONVERTED_TO_TICKET')
    )
);

CREATE TABLE IF NOT EXISTS departure_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_departure_id UUID NOT NULL,
    seat_number VARCHAR(12) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'AVAILABLE',
    reservation_id UUID REFERENCES reservations(id),
    passenger_id UUID REFERENCES passengers(id),
    hold_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_departure_seats_departure_seat UNIQUE (dispatch_departure_id, seat_number),
    CONSTRAINT ck_departure_seats_status CHECK (
        status IN ('AVAILABLE', 'RESERVED', 'SOLD', 'BLOCKED', 'CANCELLED')
    )
);

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_id INTEGER UNIQUE,
    ticket_number VARCHAR(40) NOT NULL UNIQUE,
    passenger_id UUID NOT NULL REFERENCES passengers(id),
    reservation_id UUID REFERENCES reservations(id),
    departure_seat_id UUID NOT NULL REFERENCES departure_seats(id),
    dispatch_departure_id UUID NOT NULL,
    origin_terminal_id UUID,
    destination_terminal_id UUID,
    seat_number VARCHAR(12) NOT NULL,
    fare_amount NUMERIC(12, 2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(24) NOT NULL DEFAULT 'ISSUED',
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_tickets_status CHECK (status IN ('ISSUED', 'VOIDED', 'REFUNDED', 'CHECKED_IN')),
    CONSTRAINT ck_tickets_fare_amount CHECK (fare_amount >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tickets_active_departure_seat
    ON tickets (departure_seat_id)
    WHERE status IN ('ISSUED', 'CHECKED_IN');

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

CREATE INDEX IF NOT EXISTS idx_reservations_passenger_id ON reservations (passenger_id);
CREATE INDEX IF NOT EXISTS idx_reservations_departure_status ON reservations (dispatch_departure_id, status);
CREATE INDEX IF NOT EXISTS idx_departure_seats_departure_status ON departure_seats (dispatch_departure_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_passenger_id ON tickets (passenger_id);
CREATE INDEX IF NOT EXISTS idx_tickets_departure_status ON tickets (dispatch_departure_id, status);
CREATE INDEX IF NOT EXISTS idx_outbox_events_status_created ON outbox_events (status, created_at);
