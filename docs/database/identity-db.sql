-- identity_db - initial PostgreSQL model
-- Owner service: identity-service

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_id integer UNIQUE,
    identity_type text NOT NULL CHECK (identity_type IN ('GOOGLE', 'LOCAL')),
    login citext NOT NULL UNIQUE,
    email citext NOT NULL UNIQUE,
    google_subject text UNIQUE,
    display_name text NOT NULL,
    avatar_url text,
    dark_mode boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'PENDING_ACTIVATION'
        CHECK (status IN ('ACTIVE', 'SUSPENDED', 'LOCKED', 'RETIRED', 'PENDING_ACTIVATION')),
    failed_login_attempts integer NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
    locked_until timestamptz,
    last_login_at timestamptz,
    password_changed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    retired_at timestamptz,
    CONSTRAINT ck_users_google_identity CHECK (
        identity_type <> 'GOOGLE'
        OR email IS NOT NULL
        OR google_subject IS NOT NULL
    )
);

CREATE TABLE local_credentials (
    user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    password_hash text,
    password_algorithm text NOT NULL DEFAULT 'PBKDF2WithHmacSHA256',
    temporary_password boolean NOT NULL DEFAULT false,
    must_change_password boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_local_credentials_hash CHECK (
        password_hash IS NULL OR length(password_hash) >= 20
    )
);

CREATE TABLE google_identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    google_subject text NOT NULL UNIQUE,
    email citext NOT NULL,
    email_verified boolean NOT NULL DEFAULT false,
    linked_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz,
    UNIQUE (user_id, google_subject)
);

CREATE TABLE internal_profiles (
    user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    employee_code citext UNIQUE,
    first_name text,
    last_name text,
    phone text,
    address text,
    job_title text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code citext NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    code citext PRIMARY KEY,
    description text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
    role_id uuid NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    permission_code citext NOT NULL REFERENCES permissions (code) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE user_roles (
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
    assigned_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE password_reset_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    purpose text NOT NULL CHECK (purpose IN ('ACTIVATION', 'PASSWORD_RESET', 'ACCESS_LOGIN')),
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_password_reset_token_dates CHECK (expires_at > created_at)
);

CREATE TABLE login_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users (id) ON DELETE SET NULL,
    login citext NOT NULL,
    success boolean NOT NULL,
    failure_reason text,
    ip_address inet,
    user_agent text,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    correlation_id uuid
);

CREATE TABLE outbox_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    event_type text NOT NULL,
    schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
    source_service text NOT NULL DEFAULT 'identity-service',
    correlation_id uuid NOT NULL,
    causation_id uuid,
    actor_user_id uuid,
    resource_type text,
    resource_id text,
    idempotency_key text,
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_local_credentials_updated_at
BEFORE UPDATE ON local_credentials
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_internal_profiles_updated_at
BEFORE UPDATE ON internal_profiles
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_roles_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX idx_users_status ON users (status);
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_google_identities_email ON google_identities (email);
CREATE INDEX idx_internal_profiles_employee_code ON internal_profiles (employee_code);
CREATE INDEX idx_login_attempts_user_time ON login_attempts (user_id, occurred_at DESC);
CREATE INDEX idx_login_attempts_login_time ON login_attempts (login, occurred_at DESC);
CREATE INDEX idx_outbox_events_pending ON outbox_events (status, next_attempt_at)
    WHERE status IN ('PENDING', 'FAILED');

CREATE TABLE identity_sessions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    user_agent text,
    device_name text,
    ip_address text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_identity_sessions_dates CHECK (expires_at > created_at)
);

CREATE INDEX idx_identity_sessions_active
    ON identity_sessions (user_id, expires_at)
    WHERE revoked_at IS NULL;

INSERT INTO permissions (code, description) VALUES
    ('identity.users.read', 'Listar y consultar usuarios internos.'),
    ('identity.users.write', 'Crear y modificar usuarios internos.'),
    ('identity.users.status', 'Activar, suspender y bloquear usuarios internos.'),
    ('identity.roles.read', 'Listar roles internos.'),
    ('identity.roles.manage', 'Administrar roles y permisos.'),
    ('identity.permissions.read', 'Listar permisos disponibles.'),
    ('identity.sessions.read', 'Listar sesiones activas de identidad.'),
    ('identity.sessions.revoke', 'Revocar sesiones activas de identidad.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (code, name, description) VALUES
    ('ADMIN', 'Administrador', 'Acceso administrativo inicial del modulo de identidad.'),
    ('TICKET_SELLER', 'Vendedor de pasajes', 'Rol operativo para venta de boletos.'),
    ('CUSTOMER', 'Cliente pasajero', 'Acceso publico para venta en linea sin permisos operativos internos.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
JOIN permissions p ON p.code IN ('identity.users.read', 'identity.permissions.read')
WHERE r.code = 'TICKET_SELLER'
ON CONFLICT DO NOTHING;

CREATE TABLE menu_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code citext NOT NULL UNIQUE,
    label text NOT NULL,
    icon text,
    target_url text NOT NULL,
    manifest_url text,
    informational_only boolean NOT NULL DEFAULT false,
    parent_id uuid REFERENCES menu_items (id) ON DELETE CASCADE,
    level smallint NOT NULL CHECK (level >= 1),
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
