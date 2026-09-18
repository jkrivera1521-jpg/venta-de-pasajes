ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(500),
    ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_tickets_cancelled_at
    ON tickets (cancelled_at)
    WHERE cancelled_at IS NOT NULL;
