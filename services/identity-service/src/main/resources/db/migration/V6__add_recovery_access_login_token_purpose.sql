DO $$
DECLARE
    constraint_record record;
BEGIN
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'password_reset_tokens'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%purpose%'
    LOOP
        EXECUTE format('ALTER TABLE password_reset_tokens DROP CONSTRAINT %I', constraint_record.conname);
    END LOOP;
END;
$$;

ALTER TABLE password_reset_tokens
    ADD CONSTRAINT ck_password_reset_tokens_purpose
    CHECK (purpose IN ('ACTIVATION', 'PASSWORD_RESET', 'ACCESS_LOGIN'));
