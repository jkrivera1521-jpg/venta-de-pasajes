ALTER TABLE identity_sessions
    ADD COLUMN IF NOT EXISTS device_name text;
