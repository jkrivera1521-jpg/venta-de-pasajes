CREATE INDEX IF NOT EXISTS idx_reservations_pending_expiration
    ON reservations (expires_at)
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_departure_seats_reservation_id
    ON departure_seats (reservation_id)
    WHERE reservation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_departure_seats_hold_expiration
    ON departure_seats (hold_expires_at)
    WHERE status = 'RESERVED';
