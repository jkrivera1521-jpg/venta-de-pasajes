CREATE TABLE menu_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code citext NOT NULL UNIQUE,
    label text NOT NULL,
    icon text,
    target_url text NOT NULL,
    manifest_url text,
    parent_id uuid REFERENCES menu_items (id) ON DELETE CASCADE,
    level smallint NOT NULL CHECK (level BETWEEN 1 AND 3),
    sort_order integer NOT NULL DEFAULT 0,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_menu_parent_level CHECK ((level = 1 AND parent_id IS NULL) OR (level > 1 AND parent_id IS NOT NULL))
);

CREATE TABLE menu_item_roles (
    menu_item_id uuid NOT NULL REFERENCES menu_items (id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    PRIMARY KEY (menu_item_id, role_id)
);

CREATE INDEX idx_menu_items_parent_order ON menu_items (parent_id, sort_order, label);
CREATE INDEX idx_menu_item_roles_role ON menu_item_roles (role_id, menu_item_id);

CREATE TRIGGER trg_menu_items_updated_at
BEFORE UPDATE ON menu_items
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

INSERT INTO permissions (code, description) VALUES
    ('identity.menu.read', 'Consultar el menu autorizado del sistema.'),
    ('identity.menu.manage', 'Crear, editar, ordenar y autorizar opciones del menu.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'ADMIN'
  AND p.code IN ('identity.menu.read', 'identity.menu.manage')
ON CONFLICT DO NOTHING;

INSERT INTO menu_items (code, label, icon, target_url, manifest_url, level, sort_order)
VALUES
    ('online-sales', 'Venta en linea', 'ShoppingCart', '/venta-en-linea', NULL, 1, 10),
    ('panel', 'Panel', 'LayoutDashboard', '/panel', NULL, 1, 20),
    ('identity', 'Identidad', 'ShieldCheck', '/identity', 'http://localhost:3001/mfe/manifest', 1, 30),
    ('dispatch', 'Despachos', 'CalendarClock', '/dispatch', 'http://localhost:3002/mfe/manifest', 1, 40),
    ('ticketing', 'Boleteria', 'Ticket', '/ticketing', 'http://localhost:3003/mfe/manifest', 1, 50),
    ('reporting', 'Reportes', 'BarChart3', '/reporting', 'http://localhost:3004/mfe/manifest', 1, 60),
    ('admin', 'Admin', 'Settings', '/admin', 'http://localhost:3005/mfe/manifest', 1, 70)
ON CONFLICT (code) DO NOTHING;

INSERT INTO menu_item_roles (menu_item_id, role_id)
SELECT m.id, r.id
FROM menu_items m
JOIN roles r ON r.code IN ('ADMIN', 'TICKET_SELLER')
WHERE m.code IN ('identity', 'dispatch', 'ticketing', 'reporting', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO menu_item_roles (menu_item_id, role_id)
SELECT m.id, r.id
FROM menu_items m
JOIN roles r ON r.code IN ('CUSTOMER', 'ADMIN', 'TICKET_SELLER')
WHERE m.code = 'online-sales'
ON CONFLICT DO NOTHING;

INSERT INTO menu_item_roles (menu_item_id, role_id)
SELECT m.id, r.id
FROM menu_items m
JOIN roles r ON r.code = 'ADMIN'
WHERE m.code = 'panel'
ON CONFLICT DO NOTHING;
