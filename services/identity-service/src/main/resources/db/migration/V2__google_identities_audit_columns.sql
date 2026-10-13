ALTER TABLE google_identities
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_google_identities_updated_at'
    ) THEN
        CREATE TRIGGER trg_google_identities_updated_at
        BEFORE UPDATE ON google_identities
        FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
    END IF;
END;
$$;
