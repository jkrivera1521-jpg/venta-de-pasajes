ALTER TABLE menu_items
    DROP CONSTRAINT IF EXISTS menu_items_level_check;

ALTER TABLE menu_items
    DROP CONSTRAINT IF EXISTS ck_menu_parent_level;

ALTER TABLE menu_items
    ADD CONSTRAINT ck_menu_parent_level
    CHECK ((level = 1 AND parent_id IS NULL) OR (level > 1 AND parent_id IS NOT NULL));
