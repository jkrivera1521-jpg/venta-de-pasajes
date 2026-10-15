ALTER TABLE menu_items
    ADD COLUMN IF NOT EXISTS informational_only boolean NOT NULL DEFAULT false;
