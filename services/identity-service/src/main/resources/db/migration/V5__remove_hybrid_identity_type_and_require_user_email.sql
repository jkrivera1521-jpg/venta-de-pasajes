UPDATE users
SET email = lower(login)::citext
WHERE email IS NULL
  AND login::text LIKE '%@%';

UPDATE users
SET email = ('legacy-user-' || COALESCE(legacy_id::text, replace(id::text, '-', '')) || '@identity.local')::citext
WHERE email IS NULL;

UPDATE users user_account
SET identity_type = CASE
    WHEN EXISTS (
        SELECT 1
        FROM local_credentials local_credential
        WHERE local_credential.user_id = user_account.id
    ) THEN 'LOCAL'
    ELSE 'GOOGLE'
END
WHERE identity_type = 'HYBRID';

DO $$
DECLARE
    constraint_record record;
BEGIN
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%identity_type%'
    LOOP
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_record.conname);
    END LOOP;
END;
$$;

ALTER TABLE users
    ALTER COLUMN email SET NOT NULL,
    ADD CONSTRAINT ck_users_identity_type CHECK (identity_type IN ('GOOGLE', 'LOCAL'));
