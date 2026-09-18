CREATE TABLE IF NOT EXISTS synced_departures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_departure_id UUID NOT NULL UNIQUE,
    legacy_id INTEGER,
    bus_id UUID NOT NULL,
    bus_code VARCHAR(80) NOT NULL,
    bus_plate VARCHAR(40),
    route_id UUID NOT NULL,
    route_name VARCHAR(240) NOT NULL,
    origin_terminal_id UUID NOT NULL,
    origin_terminal_name VARCHAR(240) NOT NULL,
    destination_terminal_id UUID NOT NULL,
    destination_terminal_name VARCHAR(240) NOT NULL,
    departure_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'SCHEDULED',
    seat_count INTEGER NOT NULL CHECK (seat_count > 0),
    source_updated_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_synced_departures_status CHECK (
        status IN ('SCHEDULED', 'CANCELLED', 'CLOSED', 'DEPARTED')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_synced_departures_legacy_id_not_null
    ON synced_departures (legacy_id)
    WHERE legacy_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_synced_departures_route_time
    ON synced_departures (route_id, departure_at);

CREATE INDEX IF NOT EXISTS idx_synced_departures_terminals_time
    ON synced_departures (origin_terminal_id, destination_terminal_id, departure_at);

CREATE INDEX IF NOT EXISTS idx_synced_departures_status_time
    ON synced_departures (status, departure_at);
