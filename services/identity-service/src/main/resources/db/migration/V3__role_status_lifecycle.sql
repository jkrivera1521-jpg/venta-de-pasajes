ALTER TABLE roles
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';

UPDATE roles
SET status = CASE
    WHEN active = true THEN 'ACTIVE'
    ELSE 'DELETED'
END;

UPDATE roles
SET active = CASE
    WHEN status = 'ACTIVE' THEN true
    ELSE false
END;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_roles_status'
    ) THEN
        ALTER TABLE roles
            ADD CONSTRAINT ck_roles_status CHECK (status IN ('ACTIVE', 'DISABLED', 'DELETED'));
    END IF;
END;
$$;
