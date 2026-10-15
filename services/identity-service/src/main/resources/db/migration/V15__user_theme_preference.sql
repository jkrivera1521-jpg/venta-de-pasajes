ALTER TABLE users
    ADD COLUMN IF NOT EXISTS dark_mode boolean NOT NULL DEFAULT false;
